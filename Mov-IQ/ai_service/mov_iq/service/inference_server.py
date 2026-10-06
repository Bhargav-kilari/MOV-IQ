"""Production Standalone Inference Service for MOV-IQ Pose Sequence Analysis.

Exposes a zero-framework HTTP REST API server using Python's standard library
http.server.ThreadingHTTPServer for predictable, lightweight deployment.

Endpoints:
    GET  /health   -> Service liveness and model readiness state.
    GET  /models   -> Active model architecture, classes, and metadata.
    POST /predict  -> Multi-task pose sequence inference (Exercise + Form).
    OPTIONS *      -> CORS pre-flight negotiation.
"""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import logging
from pathlib import Path
import pickle
import sys
import time
from typing import Any, Dict, List, Optional, Tuple, Union
import zipfile

import numpy as np

# Try importing torch; if Windows App Control or missing packages block it, we fall back to NumPy engine
_TORCH_AVAILABLE = False
try:
    import torch
    from mov_iq.models.sequence_model import TemporalSequenceModel
    _TORCH_AVAILABLE = True
except Exception as e:
    _TORCH_AVAILABLE = False

from mov_iq.features import FeaturePipeline
from mov_iq.preprocessing.cleaning import clean_landmarks
from mov_iq.preprocessing.fold_fitting import (
    FoldPreprocessingConfig,
    FoldPreprocessingTransformer,
)

logger = logging.getLogger("mov_iq.service")

# Canonical Core 12 Alphabetical Order
CORE12_EXERCISES = [
    "bench_press",
    "bicep_curl",
    "cable_fly",
    "cable_row",
    "chest_press",
    "incline_chest_press",
    "lat_pulldown",
    "lateral_raise",
    "pec_deck_fly",
    "rear_delt_fly",
    "shoulder_press",
    "squat",
]

FORM_NAMES = ["proper_form", "incorrect_form"]


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -50, 50)))


def _softmax(x: np.ndarray, axis: int = -1) -> np.ndarray:
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / np.sum(e, axis=axis, keepdims=True)


def _lstm_step(
    x: np.ndarray,
    h_prev: np.ndarray,
    c_prev: np.ndarray,
    w_ih: np.ndarray,
    w_hh: np.ndarray,
    b_ih: np.ndarray,
    b_hh: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    gates = x @ w_ih.T + b_ih + h_prev @ w_hh.T + b_hh
    h_dim = h_prev.shape[-1]
    i = _sigmoid(gates[..., 0:h_dim])
    f = _sigmoid(gates[..., h_dim : 2 * h_dim])
    g = np.tanh(gates[..., 2 * h_dim : 3 * h_dim])
    o = _sigmoid(gates[..., 3 * h_dim : 4 * h_dim])
    c = f * c_prev + i * g
    h = o * np.tanh(c)
    return h, c


def _run_bilstm_layer(
    x_seq: np.ndarray,
    w_ih: np.ndarray,
    w_hh: np.ndarray,
    b_ih: np.ndarray,
    b_hh: np.ndarray,
    w_ih_rev: np.ndarray,
    w_hh_rev: np.ndarray,
    b_ih_rev: np.ndarray,
    b_hh_rev: np.ndarray,
) -> np.ndarray:
    T, _ = x_seq.shape
    h_dim = w_hh.shape[1]

    # Forward pass
    h_fwd = np.zeros((T, h_dim), dtype=np.float32)
    h_curr = np.zeros(h_dim, dtype=np.float32)
    c_curr = np.zeros(h_dim, dtype=np.float32)
    for t in range(T):
        h_curr, c_curr = _lstm_step(x_seq[t], h_curr, c_curr, w_ih, w_hh, b_ih, b_hh)
        h_fwd[t] = h_curr

    # Backward pass
    h_rev = np.zeros((T, h_dim), dtype=np.float32)
    h_curr = np.zeros(h_dim, dtype=np.float32)
    c_curr = np.zeros(h_dim, dtype=np.float32)
    for t in reversed(range(T)):
        h_curr, c_curr = _lstm_step(x_seq[t], h_curr, c_curr, w_ih_rev, w_hh_rev, b_ih_rev, b_hh_rev)
        h_rev[t] = h_curr

    return np.concatenate([h_fwd, h_rev], axis=-1)


class NumpyTorchUnpickler(pickle.Unpickler):
    def __init__(self, f, zfile):
        super().__init__(f)
        self.zfile = zfile

    def find_class(self, module, name):
        if module == "torch._utils" and name == "_rebuild_tensor_v2":
            return lambda storage, storage_offset, size, stride, requires_grad, backward_hooks: storage.reshape(size)
        if module == "torch" and "Storage" in name:
            return lambda *args: args
        return super().find_class(module, name)

    def persistent_load(self, saved_id):
        tag, stor_type, key, loc, numel = saved_id
        raw = self.zfile.read(f"best_model/data/{key}")
        return np.frombuffer(raw, dtype=np.float32)


class ModelEngine:
    """Encapsulates checkpoint loading, fold preprocessing, feature extraction, and inference."""

    def __init__(
        self,
        checkpoint_path: Union[str, Path],
        device: str = "cpu",
    ) -> None:
        self.device_str = device
        self.checkpoint_path = Path(checkpoint_path)

        if not self.checkpoint_path.is_file():
            raise FileNotFoundError(f"Checkpoint not found at: {self.checkpoint_path}")

        logger.info("Loading model checkpoint from %s...", self.checkpoint_path)

        # Load checkpoint data
        self.use_torch = False
        if _TORCH_AVAILABLE:
            try:
                self.device = torch.device(device)
                self.ckpt_data = torch.load(self.checkpoint_path, map_location=self.device)
                m_cfg = self.ckpt_data.get("model_config", {})
                self.input_dim = self.ckpt_data.get("input_dim", 312)
                self.num_classes = self.ckpt_data.get("num_classes", 12)
                self.tasks = self.ckpt_data.get("tasks", {
                    "form_classification": {"enabled": True, "type": "classification", "num_classes": 2}
                })
                self.exercise_classes = self.ckpt_data.get("exercise_classes", CORE12_EXERCISES)
                self.form_classes = self.ckpt_data.get("form_classes", FORM_NAMES)
                self.best_metrics = self.ckpt_data.get("best_metrics", {})
                self.fold_id = self.ckpt_data.get("fold_id", "canonical_best")

                self.model = TemporalSequenceModel(
                    input_dim=self.input_dim,
                    num_classes=self.num_classes,
                    tasks=self.tasks,
                    projection_dim=m_cfg.get("projection_dim", 128),
                    hidden_dim=m_cfg.get("hidden_dim", 128),
                    num_layers=m_cfg.get("num_layers", 2),
                    dropout=m_cfg.get("dropout", 0.3),
                    bidirectional=m_cfg.get("bidirectional", True),
                    pooling=m_cfg.get("pooling", "mean"),
                ).to(self.device)

                self.model.load_state_dict(self.ckpt_data["model_state_dict"])
                self.model.eval()
                self.use_torch = True
                logger.info("Loaded PyTorch TemporalSequenceModel successfully.")
            except Exception as e:
                logger.warning("PyTorch model initialization failed (%s). Falling back to pure NumPy inference.", e)
                self.use_torch = False

        if not self.use_torch:
            with zipfile.ZipFile(self.checkpoint_path) as z:
                unpickler = NumpyTorchUnpickler(io.BytesIO(z.read("best_model/data.pkl")), z)
                self.ckpt_data = unpickler.load()

            self.weights = self.ckpt_data["model_state_dict"]
            self.input_dim = self.ckpt_data.get("input_dim", 312)
            self.num_classes = self.ckpt_data.get("num_classes", 12)
            self.tasks = self.ckpt_data.get("tasks", {
                "form_classification": {"enabled": True, "type": "classification", "num_classes": 2}
            })
            self.exercise_classes = self.ckpt_data.get("exercise_classes", CORE12_EXERCISES)
            self.form_classes = self.ckpt_data.get("form_classes", FORM_NAMES)
            self.best_metrics = self.ckpt_data.get("best_metrics", {})
            self.fold_id = self.ckpt_data.get("fold_id", "canonical_best")
            logger.info("Loaded NumPy weights successfully (%d weight tensors).", len(self.weights))

        # Fold Preprocessing & Feature Pipeline
        fold_prep = self.ckpt_data.get("fold_preprocessing")
        if fold_prep:
            cfg = FoldPreprocessingConfig.from_dict(fold_prep)
            self.transformer = FoldPreprocessingTransformer(cfg)
            vel_clip = self.transformer.config.velocity_clip
            acc_clip = self.transformer.config.acceleration_clip
        else:
            self.transformer = None
            vel_clip = (-35.0, 35.0)
            acc_clip = (-2500.0, 2500.0)

        self.feature_pipeline = FeaturePipeline(
            velocity_clip=vel_clip,
            acceleration_clip=acc_clip,
        )

        logger.info(
            "ModelEngine ready. Backend: %s, Input dim: %d, Exercises: %d, Form classes: %d",
            "PyTorch" if self.use_torch else "NumPy",
            self.input_dim,
            len(self.exercise_classes),
            len(self.form_classes),
        )

    def predict_from_landmarks(
        self,
        landmarks: np.ndarray,
        fps: float = 30.0,
    ) -> Dict[str, Any]:
        """Process raw/normalized landmarks [T, 33, 3 or 4], extract features, and predict."""
        if landmarks.ndim != 3:
            raise ValueError(f"Landmarks must have shape [T, 33, 3 or 4], got shape {landmarks.shape}")
        if landmarks.shape[1] != 33:
            raise ValueError(f"Expected 33 landmarks per frame, got {landmarks.shape[1]}")
        if landmarks.shape[0] < 2:
            raise ValueError(f"Sequence length must be at least 2 frames, got {landmarks.shape[0]}")

        # 1. Clean missing/invalid landmark frames
        cleaned_lm, _ = clean_landmarks(landmarks)

        # 2. Apply fold standardization if available
        if self.transformer is not None:
            cleaned_lm = self.transformer.standardize_landmarks(cleaned_lm)

        # 3. Extract 312-dimensional biomechanical features
        features = self.feature_pipeline(cleaned_lm)

        return self.predict_from_features(features)

    def predict_from_features(
        self,
        features: np.ndarray,
    ) -> Dict[str, Any]:
        """Execute forward pass on pre-extracted feature array [T, 312]."""
        if features.ndim != 2:
            raise ValueError(f"Features must have shape [T, D], got shape {features.shape}")
        if features.shape[1] != self.input_dim:
            raise ValueError(f"Expected feature dim {self.input_dim}, got {features.shape[1]}")

        t_start = time.perf_counter()
        seq_len = features.shape[0]

        if self.use_torch:
            feat_tensor = torch.from_numpy(
                np.ascontiguousarray(features, dtype=np.float32)
            ).unsqueeze(0).to(self.device)
            len_tensor = torch.tensor([seq_len], dtype=torch.long).to(self.device)

            with torch.no_grad():
                outputs = self.model(feat_tensor, lengths=len_tensor)
                ex_logits = outputs["exercise_classification"].squeeze(0)
                ex_probs = torch.softmax(ex_logits, dim=-1).cpu().numpy()
                form_logits = outputs["form_classification"].squeeze(0)
                form_probs = torch.softmax(form_logits, dim=-1).cpu().numpy()
        else:
            w = self.weights
            # 1. Feature Projection + LayerNorm + ReLU
            proj = features @ w["feature_projection.0.weight"].T + w["feature_projection.0.bias"]
            mean = proj.mean(axis=-1, keepdims=True)
            var = proj.var(axis=-1, keepdims=True)
            proj = (proj - mean) / np.sqrt(var + 1e-5) * w["feature_projection.1.weight"] + w["feature_projection.1.bias"]
            proj = np.maximum(0, proj)

            # 2. Temporal BiLSTM Layer 0
            l0 = _run_bilstm_layer(
                proj,
                w["temporal_encoder.weight_ih_l0"], w["temporal_encoder.weight_hh_l0"],
                w["temporal_encoder.bias_ih_l0"], w["temporal_encoder.bias_hh_l0"],
                w["temporal_encoder.weight_ih_l0_reverse"], w["temporal_encoder.weight_hh_l0_reverse"],
                w["temporal_encoder.bias_ih_l0_reverse"], w["temporal_encoder.bias_hh_l0_reverse"],
            )

            # 3. Temporal BiLSTM Layer 1
            l1 = _run_bilstm_layer(
                l0,
                w["temporal_encoder.weight_ih_l1"], w["temporal_encoder.weight_hh_l1"],
                w["temporal_encoder.bias_ih_l1"], w["temporal_encoder.bias_hh_l1"],
                w["temporal_encoder.weight_ih_l1_reverse"], w["temporal_encoder.weight_hh_l1_reverse"],
                w["temporal_encoder.bias_ih_l1_reverse"], w["temporal_encoder.bias_hh_l1_reverse"],
            )

            # 4. Mean Pooling
            pooled = l1.mean(axis=0)

            # 5. Exercise Classification Head
            ex_h = np.maximum(0, pooled @ w["_heads.exercise_classification.0.weight"].T + w["_heads.exercise_classification.0.bias"])
            ex_logits = ex_h @ w["_heads.exercise_classification.3.weight"].T + w["_heads.exercise_classification.3.bias"]
            ex_probs = _softmax(ex_logits)

            # 6. Form Classification Head
            fm_h = np.maximum(0, pooled @ w["_heads.form_classification.0.weight"].T + w["_heads.form_classification.0.bias"])
            fm_logits = fm_h @ w["_heads.form_classification.3.weight"].T + w["_heads.form_classification.3.bias"]
            form_probs = _softmax(fm_logits)

        ex_idx = int(np.argmax(ex_probs))
        ex_conf = float(ex_probs[ex_idx])
        ex_name = self.exercise_classes[ex_idx] if ex_idx < len(self.exercise_classes) else f"class_{ex_idx}"

        form_idx = int(np.argmax(form_probs))
        form_conf = float(form_probs[form_idx])
        form_name = self.form_classes[form_idx] if form_idx < len(self.form_classes) else f"form_{form_idx}"

        infer_time_ms = (time.perf_counter() - t_start) * 1000.0

        return {
            "exercise": {
                "prediction": ex_name,
                "class_id": ex_idx,
                "confidence": round(ex_conf, 4),
                "probabilities": {
                    cls_name: round(float(p), 4)
                    for cls_name, p in zip(self.exercise_classes, ex_probs)
                },
            },
            "form": {
                "prediction": form_name,
                "class_id": form_idx,
                "confidence": round(form_conf, 4),
                "probabilities": {
                    cls_name: round(float(p), 4)
                    for cls_name, p in zip(self.form_classes, form_probs)
                },
            },
            "sequence_length": seq_len,
            "inference_time_ms": round(infer_time_ms, 2),
        }


# Global engine instance for handler access
_ENGINE: Optional[ModelEngine] = None


class MOVInferenceHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler implementing REST endpoints with full CORS headers."""

    def _set_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def _send_json_response(self, status_code: int, data: Dict[str, Any]) -> None:
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        """Handle CORS pre-flight negotiations."""
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        """Route GET requests: /health, /models."""
        path = self.path.split("?")[0].rstrip("/")

        if path in ("", "/health", "/api/health"):
            is_ready = _ENGINE is not None
            self._send_json_response(200, {
                "status": "healthy" if is_ready else "unhealthy",
                "service": "mov-iq-inference-service",
                "version": "1.0.0",
                "model_loaded": is_ready,
                "model_device": "cpu" if is_ready else "none",
                "feature_dim": _ENGINE.input_dim if is_ready else 0,
                "checkpoint": str(_ENGINE.checkpoint_path.name) if is_ready else None,
            })
            return

        if path in ("/models", "/api/models"):
            if _ENGINE is None:
                self._send_json_response(503, {"error": "Model engine not initialized."})
                return

            self._send_json_response(200, {
                "active_model": {
                    "checkpoint": str(_ENGINE.checkpoint_path.name),
                    "fold_id": _ENGINE.fold_id,
                    "architecture": "TemporalSequenceModel (BiLSTM 2-layer, 128 hidden, Temporal Mean Pooling)",
                    "input_dim": _ENGINE.input_dim,
                    "tasks": list(_ENGINE.tasks.keys()),
                    "exercise_classes": _ENGINE.exercise_classes,
                    "form_classes": _ENGINE.form_classes,
                    "validation_performance": _ENGINE.best_metrics,
                }
            })
            return

        self._send_json_response(404, {
            "error": "Not Found",
            "message": f"Endpoint '{self.path}' is not recognized. Use /health, /models, or POST /predict.",
        })

    def do_POST(self) -> None:
        """Route POST requests: /predict."""
        path = self.path.split("?")[0].rstrip("/")

        if path not in ("/predict", "/api/predict"):
            self._send_json_response(404, {"error": "Not Found", "message": f"Endpoint '{self.path}' not recognized."})
            return

        if _ENGINE is None:
            self._send_json_response(503, {"error": "Model engine not loaded."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self._send_json_response(400, {"error": "Bad Request", "message": "Request body cannot be empty."})
                return

            raw_body = self.rfile.read(content_length).decode("utf-8")
            payload = json.loads(raw_body)
        except Exception as err:
            self._send_json_response(400, {"error": "Invalid JSON", "message": str(err)})
            return

        try:
            fps = float(payload.get("fps", 30.0))

            if "landmarks" in payload:
                raw_lms = np.array(payload["landmarks"], dtype=np.float32)
                res = _ENGINE.predict_from_landmarks(raw_lms, fps=fps)
            elif "features" in payload:
                raw_feats = np.array(payload["features"], dtype=np.float32)
                res = _ENGINE.predict_from_features(raw_feats)
            else:
                self._send_json_response(400, {
                    "error": "Bad Request",
                    "message": "Payload must contain either 'landmarks' [T, 33, 3] or 'features' [T, 312].",
                })
                return

            if "exercise_hint" in payload:
                res["exercise_hint"] = payload["exercise_hint"]

            self._send_json_response(200, res)

        except ValueError as val_err:
            self._send_json_response(400, {"error": "Validation Error", "message": str(val_err)})
        except Exception as exc:
            logger.exception("Error processing inference request: %s", exc)
            self._send_json_response(500, {"error": "Internal Inference Error", "message": str(exc)})

    def log_message(self, format: str, *args: Any) -> None:
        """Use module logger instead of standard stderr print."""
        logger.debug("%s - - [%s] %s", self.client_address[0], self.log_date_time_string(), format % args)


def run_server(
    host: str = "0.0.0.0",
    port: int = 8000,
    checkpoint_path: Union[str, Path] = "checkpoints/best_model.pt",
    device: str = "cpu",
) -> None:
    """Launch the threaded HTTP inference server."""
    global _ENGINE
    _ENGINE = ModelEngine(checkpoint_path=checkpoint_path, device=device)

    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, MOVInferenceHandler)
    logger.info("MOV-IQ Inference Server running on http://%s:%d (Press Ctrl+C to stop)", host, port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Stopping MOV-IQ Inference Server...")
    finally:
        httpd.server_close()
        logger.info("Server stopped.")


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    parser = argparse.ArgumentParser(description="MOV-IQ REST Inference Service")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port number (default: 8000)")
    parser.add_argument(
        "--checkpoint",
        type=str,
        default="checkpoints/best_model.pt",
        help="Path to trained checkpoint (.pt)",
    )
    parser.add_argument("--device", type=str, default="cpu", help="Compute device ('cpu' or 'cuda')")

    args = parser.parse_args()
    run_server(host=args.host, port=args.port, checkpoint_path=args.checkpoint, device=args.device)
    return 0


if __name__ == "__main__":
    sys.exit(main())
