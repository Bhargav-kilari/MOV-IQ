# MODEL ANALYSIS REPORT — MOV-IQ AI ASSISTANCE

```text
MODEL ANALYSIS

Model: TemporalSequenceModel (2-Layer BiLSTM + Temporal Mean Pooling)
Framework: PyTorch (State dict in .pt checkpoint format), executed via High-Performance NumPy/Torch Engine
Version: MOV-IQ Stage 4 Baseline (Checkpoint: best_model.pt, Selected Fold: fold_2, Best Epoch: 12)
Input: 3D Human Pose Landmarks sequence of shape [T, 33, 3] (33 MediaPipe Pose Landmarks: x, y, z; minimum T >= 2 frames; recommended T ~ 30-60 frames at ~30 FPS)
Output: Multi-Task Classification:
  1. Exercise Classification (12 core exercises with class probabilities & confidence score)
  2. Form Quality Classification ("proper_form" vs "incorrect_form" with confidence score & probabilities)
  3. Metadata (sequence_length, inference_time_ms, exercise_hint)
Supported exercises: 12 core exercises
  - bench_press
  - bicep_curl
  - cable_fly
  - cable_row
  - chest_press
  - incline_chest_press
  - lat_pulldown
  - lateral_raise
  - pec_deck_fly
  - rear_delt_fly
  - shoulder_press
  - squat
Exercise classification: Supported natively (12 classes)
Rep counting: NOT natively output by the sequence neural network
Form classification: Supported natively ("proper_form" vs "incorrect_form")
Mistake detection: NOT natively distinguished into specific sub-types by the neural network
Confidence: Supported natively (Softmax probabilities for both exercise and form quality)
Pose landmarks: MediaPipe 33 full-body landmarks (BlazePose topology)
Required preprocessing: 
  - Landmark cleaning & NaN validation (clean_landmarks)
  - Fold coordinate standardization (FoldPreprocessingTransformer using fold_2 training mean & std)
  - Biomechanical Feature Pipeline (312-dim vector: 99 raw coordinates, 8 joint angles, 7 joint distances, 198 clipped velocities & accelerations)
Inference location: Local REST inference service (port 8000), proxied via MOV-IQ Node.js backend
CPU/GPU requirements: Lightweight CPU inference (~10–25 ms per sequence, ~2.6 MB weights)
Known limitations:
  - Supports only the 12 core trained gym exercises. Other exercises in the 1,324+ catalog are not AI-analyzed by this model.
  - The neural network classifies sequence-level form as binary ("proper_form" vs "incorrect_form") without multi-label fine-grained error taxonomy.
  - Rep counting and specific joint angle coaching are provided by MOV-IQ's deterministic kinematic analysis layer operating on landmarks alongside the neural model.
```

---

## Capabilities Classification

```text
SUPPORTED
-----------
• Pose landmark ingestion (MediaPipe 33-landmark format)
• 312-dimensional biomechanical feature extraction
• Exercise identification across 12 core exercises (bench_press, bicep_curl, cable_fly, cable_row, chest_press, incline_chest_press, lat_pulldown, lateral_raise, pec_deck_fly, rear_delt_fly, shoulder_press, squat)
• Form classification into proper_form vs incorrect_form
• Confidence scores and full probability distributions for exercise & form
• Fast real-time CPU inference (<25 ms)

NOT SUPPORTED (BY NEURAL NETWORK DIRECTLY)
-------------
• Automatic rep counting directly inside the neural network output
• Specific granular mistake sub-classification (e.g., distinguishing "knee valgus" vs "shallow depth" inside the neural network heads)
• Exercises outside the 12 core exercises catalog
• Multi-person pose tracking (model assumes single subject)
```

---

## Architectural Separation of Concerns

To guarantee honesty and avoid faking AI capabilities:

1. **MODEL OUTPUT**:
   - `exercise.prediction`: Predicted exercise among 12 core exercises
   - `exercise.confidence`: Prediction probability (0.0 to 1.0)
   - `form.prediction`: Overall form quality (`proper_form` | `incorrect_form`)
   - `form.confidence`: Quality confidence probability (0.0 to 1.0)

2. **MOV-IQ KINEMATIC ANALYSIS LAYER**:
   - **Rep Counting**: Deterministic state machine based on primary joint angle trajectories (e.g. knee flexion/extension for squats, elbow flexion/extension for curls and presses).
   - **Mistake Detection**: Specific biomechanical checks on landmark angles (e.g. knee depth < 90°, elbow flare, trunk lean angle) that correlate with and explain why form was categorized as `incorrect_form`.
   - **Form Score (0–100)**: Derived from the ratio of correct reps and the model's form confidence throughout the session.
