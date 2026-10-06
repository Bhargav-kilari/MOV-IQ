# MOV-IQ Inference API Specification (v1.0.0)

REST API Contract for integrating MOV-IQ Exercise and Form Analysis into external web and backend applications.

---

## Base URL
Default: `http://localhost:8000`

---

## 1. Health Check
Checks service liveness and confirms the model weights are resident in memory.

- **Method:** `GET`
- **Path:** `/health`
- **Response `200 OK`:**
```json
{
  "status": "healthy",
  "service": "mov-iq-inference-service",
  "version": "1.0.0",
  "model_loaded": true,
  "model_device": "cpu",
  "feature_dim": 312,
  "checkpoint": "best_model.pt"
}
```

---

## 2. Models Metadata
Returns architectural metadata, supported exercises, form classes, and validation metrics.

- **Method:** `GET`
- **Path:** `/models`
- **Response `200 OK`:**
```json
{
  "active_model": {
    "checkpoint": "best_model.pt",
    "fold_id": "fold_2",
    "architecture": "TemporalSequenceModel (BiLSTM 2-layer, 128 hidden, Temporal Mean Pooling)",
    "input_dim": 312,
    "tasks": ["exercise_classification", "form_classification"],
    "exercise_classes": [
      "bench_press", "bicep_curl", "cable_fly", "cable_row",
      "chest_press", "incline_chest_press", "lat_pulldown", "lateral_raise",
      "pec_deck_fly", "rear_delt_fly", "shoulder_press", "squat"
    ],
    "form_classes": ["proper_form", "incorrect_form"],
    "validation_performance": {
      "best_epoch": 12,
      "form_acc": 0.714,
      "form_f1": 0.650,
      "ex_acc": 0.429,
      "val_loss": 5.4945
    }
  }
}
```

---

## 3. Predict Pose Sequence
Performs multi-task inference predicting:
1. Exercise classification (Core 12 benchmark)
2. Unified form quality (`proper_form` vs `incorrect_form`)

- **Method:** `POST`
- **Path:** `/predict`
- **Headers:** `Content-Type: application/json`
- **Request Body (Landmarks Input - Recommended):**
```json
{
  "landmarks": [
    [
      [x_0, y_0, z_0],
      ... 33 MediaPipe landmarks ...
      [x_32, y_32, z_32]
    ],
    ... T frames (minimum 2 frames) ...
  ],
  "fps": 30.0,
  "exercise_hint": "squat"
}
```

- **Response `200 OK`:**
```json
{
  "exercise": {
    "prediction": "squat",
    "class_id": 11,
    "confidence": 0.8421,
    "probabilities": {
      "bench_press": 0.0120,
      "bicep_curl": 0.0084,
      "cable_fly": 0.0051,
      "cable_row": 0.0112,
      "chest_press": 0.0145,
      "incline_chest_press": 0.0093,
      "lat_pulldown": 0.0210,
      "lateral_raise": 0.0354,
      "pec_deck_fly": 0.0042,
      "rear_delt_fly": 0.0078,
      "shoulder_press": 0.0289,
      "squat": 0.8421
    }
  },
  "form": {
    "prediction": "proper_form",
    "class_id": 0,
    "confidence": 0.7645,
    "probabilities": {
      "proper_form": 0.7645,
      "incorrect_form": 0.2355
    }
  },
  "sequence_length": 60,
  "inference_time_ms": 14.82,
  "exercise_hint": "squat"
}
```

---

## 4. Error Responses

- **`400 Bad Request`:** When input JSON is malformed, landmarks shape is invalid, or sequence length < 2 frames.
```json
{
  "error": "Validation Error",
  "message": "Expected 33 landmarks per frame, got 21"
}
```

- **`404 Not Found`:** For unrecognized paths.
- **`500 Internal Error`:** For unhandled exceptions during inference.
