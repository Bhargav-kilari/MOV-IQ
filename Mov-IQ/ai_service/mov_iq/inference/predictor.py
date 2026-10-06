"""Inference and prediction pipeline for MOV-IQ pose sequence analysis."""

import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union
import numpy as np
import torch
import torch.nn as nn

from mov_iq.data.schema import PoseSequenceSample
from mov_iq.models.base import BaseSequenceModel

logger = logging.getLogger(__name__)


class ModelNotTrainedError(Exception):
    """Raised when inference is attempted on an uninitialized or untrained model."""
    pass


class PosePredictor:
    """High-level production inference interface for predicting movements from pose sequences.

    Applies the identical preprocessing and feature extraction transformations used during
    training before querying the underlying sequence model.
    """

    def __init__(
        self,
        model: Optional[BaseSequenceModel] = None,
        checkpoint_path: Optional[Union[str, Path]] = None,
        preprocessing_fn: Optional[Callable[[np.ndarray], np.ndarray]] = None,
        feature_extractor_fn: Optional[Callable[[np.ndarray], np.ndarray]] = None,
        idx_to_label: Optional[Dict[int, str]] = None,
        device: Union[str, torch.device] = "cpu",
    ) -> None:
        """Initialize the predictor.

        Args:
            model: Optional initialized BaseSequenceModel.
            checkpoint_path: Optional path to saved model weights.
            preprocessing_fn: Transformation callable (e.g. PreprocessingPipeline).
            feature_extractor_fn: Feature extraction callable (e.g. FeaturePipeline).
            idx_to_label: Mapping from integer class index to human-readable exercise name.
            device: Compute device ('cpu' or 'cuda').
        """
        self.device = torch.device(device)
        self.preprocessing_fn = preprocessing_fn
        self.feature_extractor_fn = feature_extractor_fn
        self.idx_to_label = idx_to_label or {}
        self.is_ready = False

        if model is not None:
            self.model = model.to(self.device)
            self.model.eval()
            self.is_ready = True
        elif checkpoint_path is not None:
            self.load_checkpoint(checkpoint_path)
        else:
            self.model = None

    def load_checkpoint(self, checkpoint_path: Union[str, Path]) -> None:
        """Load trained model weights from disk."""
        path = Path(checkpoint_path)
        if not path.is_file():
            raise FileNotFoundError(f"Checkpoint file not found: {path}")

        checkpoint = torch.load(path, map_location=self.device)
        if "model_state_dict" not in checkpoint:
            raise KeyError("Checkpoint does not contain 'model_state_dict'")

        if self.model is not None:
            self.model.load_state_dict(checkpoint["model_state_dict"])
        else:
            raise ModelNotTrainedError(
                "Base model instance must be provided before loading state dict weights."
            )

        self.model.to(self.device)
        self.model.eval()
        self.is_ready = True
        logger.info("Loaded predictor weights from: %s", path)

    def predict(
        self,
        sequence: Union[np.ndarray, PoseSequenceSample],
        task_name: str = "exercise_classification",
    ) -> Dict[str, Any]:
        """Perform movement prediction on a single pose sequence.

        Args:
            sequence: Raw landmark array [T, N, F] or PoseSequenceSample instance.
            task_name: Target prediction task.

        Returns:
            Structured prediction dictionary containing:
                - 'exercise': predicted exercise name
                - 'class_id': predicted integer class index
                - 'confidence': confidence score (probability) in [0.0, 1.0]
                - 'probabilities': mapping of all class labels to probabilities
                - 'sequence_length': number of frames in sequence
                - 'metadata': input or diagnostic metadata
        """
        if not self.is_ready or self.model is None:
            raise ModelNotTrainedError(
                "The MOV-IQ sequence model has not been trained or loaded with weights. "
                "Train a model using 'python scripts/train.py' after supplying training data."
            )

        # Extract landmark array
        if isinstance(sequence, PoseSequenceSample):
            landmarks = sequence.landmarks.copy()
            meta = sequence.to_dict()
        else:
            landmarks = np.asarray(sequence, dtype=np.float32)
            meta = {}

        if landmarks.ndim != 3:
            raise ValueError(f"Input landmarks must be 3D [T, N, F], got shape {landmarks.shape}")

        orig_len = landmarks.shape[0]

        # 1. Apply preprocessing
        if self.preprocessing_fn is not None:
            landmarks = self.preprocessing_fn(landmarks)

        # 2. Apply feature extraction
        if self.feature_extractor_fn is not None:
            features = self.feature_extractor_fn(landmarks)
        else:
            t = landmarks.shape[0]
            features = landmarks.reshape(t, -1)

        # 3. Model forward pass
        feature_tensor = torch.from_numpy(
            np.ascontiguousarray(features, dtype=np.float32)
        ).unsqueeze(0).to(self.device)  # [1, T, D]

        self.model.eval()
        with torch.no_grad():
            outputs = self.model(feature_tensor)
            if task_name not in outputs:
                raise KeyError(f"Task '{task_name}' not found in model outputs: {list(outputs.keys())}")

            logits = outputs[task_name].squeeze(0)  # [num_classes]
            probs = torch.softmax(logits, dim=-1).cpu().numpy()
            predicted_class_id = int(np.argmax(probs))
            confidence = float(probs[predicted_class_id])

        predicted_exercise = self.idx_to_label.get(
            predicted_class_id, f"exercise_{predicted_class_id}"
        )

        prob_dict = {
            self.idx_to_label.get(i, f"class_{i}"): float(prob)
            for i, prob in enumerate(probs)
        }

        return {
            "exercise": predicted_exercise,
            "class_id": predicted_class_id,
            "confidence": confidence,
            "probabilities": prob_dict,
            "sequence_length": orig_len,
            "metadata": meta,
        }
