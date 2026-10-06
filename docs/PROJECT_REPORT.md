# MOV-IQ — Full Project Engineering Report
**"Move Smarter. Get Stronger."**
*Comprehensive Technical Documentation, System Architecture, AI Model Integration, and Verification*

---

## 1. Executive Summary

**MOV-IQ** is a consumer-grade, production-style web application designed for comprehensive gym workout logging, routine management, analytics, and **AI-powered real-time exercise form analysis**.

The core objective of this project phase was the seamless integration of a pre-trained Deep Learning temporal sequence model (**MOV-IQ Stage 4 Baseline**) into the existing application without disrupting the existing user interface, PostgreSQL database schema, authentication system, or workout logger.

### Key Highlights
- **1,343 Master Exercises Library** preserved and accessible via search and muscle group filters.
- **Trained Deep Learning Model Operationalized**: 2-layer Bidirectional LSTM temporal sequence model with multi-task heads for exercise identification and binary form classification (`proper_form` vs `incorrect_form`).
- **High-Performance Inference**: Sub-15ms (~10.7 ms) sequence inference on CPU, completely decoupled from video streaming.
- **Zero Fake AI**: Honest architectural separation between neural network predictions (exercise classification and form confidence) and deterministic kinematic analysis (rep counting state machine and biomechanical joint angle boundaries).
- **Privacy by Design**: Video frames are processed locally inside the browser using MediaPipe Pose. No raw camera footage is ever uploaded or persisted.
- **Persistent AI Assessments**: Full workout assessments are stored in the PostgreSQL `future_ai_analysis` table and linked directly to user profiles and exercise catalog records.

---

## 2. System Architecture

MOV-IQ employs a modular, micro-service-oriented architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT BROWSER                                │
│                                                                         │
│   React 18 + Vite Frontend (Port 5173)                                  │
│   ├── MediaPipe Pose JS (33 Landmarks Extraction)                       │
│   ├── Kinematics Engine (Joint Angles & Rep Counting State Machine)     │
│   └── 60 FPS Mirrored Canvas HUD with Real-time Skeleton Overlay        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                     HTTP / REST     │ [/api/ai/predict, /api/workouts, ...]
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        NODE.JS / EXPRESS BACKEND                        │
│                                                                         │
│   REST API Gateway & Business Logic (Port 5000)                         │
│   ├── Authentication Middleware (JWT)                                   │
│   ├── Exercise Catalog, Routines, and Workout Controllers               │
│   ├── AI Gateway Controller (Proxying & Health Monitoring)              │
│   └── Body Parser Optimized with 10MB Payload Limits                    │
└──────────────────┬─────────────────────────────────┬────────────────────┘
                   │                                 │
                   │ PostgreSQL Protocol             │ HTTP REST (Port 8000)
                   ▼                                 ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────┐
│         POSTGRESQL DATABASE          │  │     PYTHON INFERENCE ENGINE   │
│                                      │  │                               │
│   Relational Store (Port 5432)       │  │   MOV-IQ Stage 4 Service      │
│   ├── users                          │  │   ├── Preprocessing Pipeline  │
│   ├── exercises (1,343 items)        │  │   ├── Feature Pipeline (312D) │
│   ├── routines & routine_exercises   │  │   ├── BiLSTM Model (fold_2)   │
│   ├── workouts & workout_sets        │  │   └── ThreadingHTTPServer     │
│   └── future_ai_analysis             │  └───────────────────────────────┘
└──────────────────────────────────────┘
```

---

## 3. Deep Learning Model Analysis & Technical Specification

The trained model supplied in `Mov-IQ` was rigorously inspected, extracted, and benchmarked.

### Technical Profile
| Attribute | Specification |
| :--- | :--- |
| **Model Class** | `TemporalSequenceModel` |
| **Recurrent Architecture** | 2-Layer Bidirectional LSTM (`hidden_dim = 128`, `dropout = 0.3`) |
| **Feature Projection** | Linear(312 $\rightarrow$ 128) + LayerNorm(128) + ReLU + Dropout(0.3) |
| **Temporal Aggregation** | Temporal Mean Pooling over sequence length $T$ |
| **Task Heads** | 1. `exercise_classification`: Linear(256 $\rightarrow$ 64) $\rightarrow$ ReLU $\rightarrow$ Linear(64 $\rightarrow$ 12) $\rightarrow$ Softmax<br>2. `form_classification`: Linear(256 $\rightarrow$ 64) $\rightarrow$ ReLU $\rightarrow$ Linear(64 $\rightarrow$ 2) $\rightarrow$ Softmax |
| **Checkpoint** | `best_model.pt` (Fold: `fold_2`, Best Epoch: 12) |
| **Parameters Size** | ~2.6 MB weights |
| **Inference Latency** | **10.74 ms** per 60-frame sequence on CPU |

### Feature Engineering Pipeline (312 Dimensions)
Each frame's 33 raw MediaPipe pose landmarks ($x, y, z$) are transformed into a 312-dimensional biomechanical representation:
1. **Raw Landmarks (99 dims)**: Normalized 3D coordinates ($33 \times 3$) centered via fold-specific training distribution (`coordinate_mean` and `coordinate_std`).
2. **Biomechanical Joint Angles (8 dims)**: 3D angles calculating bilateral elbow, shoulder, hip, and knee flexion.
3. **Joint-to-Joint Distances (7 dims)**: Relative keypoint distances measuring body extension and torso stability.
4. **Temporal Dynamics (198 dims)**:
   - First-order velocity ($33 \times 3 = 99$ dims) clipped to reference thresholds.
   - Second-order acceleration ($33 \times 3 = 99$ dims) clipped to reference thresholds.

### Supported Exercises (The Core 12)
The neural network specifically recognizes and evaluates form for 12 canonical gym exercises:
1. `bench_press` (Barbell / Dumbbell Bench Press)
2. `bicep_curl` (Barbell / Dumbbell Bicep Curl)
3. `cable_fly` (Cable Middle / Low Fly)
4. `cable_row` (Seated Cable Row)
5. `chest_press` (Machine / Lever Chest Press)
6. `incline_chest_press` (Incline Bench / Cable Press)
7. `lat_pulldown` (Lat Pulldown)
8. `lateral_raise` (Dumbbell Lateral Raise)
9. `pec_deck_fly` (Lever Seated Fly / Pec Deck)
10. `rear_delt_fly` (Rear Delt Fly / Reverse Fly)
11. `shoulder_press` (Overhead Press / Dumbbell Press)
12. `squat` (Barbell / Bodyweight Squat)

### Capabilities Classification Matrix
| Capability | Model Native | MOV-IQ Kinematic Layer | Status |
| :--- | :---: | :---: | :--- |
| **Pose Landmark Ingestion** | Yes | Yes | **SUPPORTED** |
| **312-D Feature Extraction** | Yes | — | **SUPPORTED** |
| **Exercise Identification** | Yes (12 classes) | — | **SUPPORTED** |
| **Form Quality (`proper` vs `incorrect`)** | Yes (Binary) | — | **SUPPORTED** |
| **Confidence Scores** | Yes | — | **SUPPORTED** |
| **Rep Counting** | No | Yes (State Machine) | **SUPPORTED (Deterministic)** |
| **Specific Joint Mistake Analysis** | No | Yes (Angle Thresholds) | **SUPPORTED (Biomechanical)** |
| **Exercises Outside Core 12** | No | No | **UNSUPPORTED (Explicitly Guarded)** |
| **Multi-Person Tracking** | No | No | **UNSUPPORTED (Single Subject Only)** |

---

## 4. End-to-End User Flow & UI/UX Design

The user experience strictly respects MOV-IQ's minimalist, white-background, high-contrast, consumer-grade fitness design system.

```
AI Assistance
      ↓
Step 1: Choose Exercise
  • AI Supported (12) vs Full Catalog (1,324+)
  • AI Verified badges & muscle group filtering
      ↓
Step 2: Camera Setup & Technique Guide
  • Device permissions & live preview
  • Positioning checklist (full body visible, 6-8 ft, front lighting)
      ↓
Step 3: Dedicated Live AI Analysis Interface
  • Real-time skeleton canvas overlay
  • Live joint angle gauge (e.g. Knee angle: 88°)
  • Rep counter (Total / Correct / Incorrect)
  • Exercise mismatch detection
  • Real-time prioritized coaching banner
  • Rep history log
      ↓
Step 4: AI Workout Assessment
  • Overall Form Score (0–100)
  • Detected issues breakdown (reps affected)
  • Movement quality metrics (Range of Motion, Consistency, Tempo)
  • Synthesized AI coaching feedback
  • [Save AI Assessment] to PostgreSQL history
```

---

## 5. Database Schema & Persistence

AI sessions are persisted in the PostgreSQL database using the `future_ai_analysis` table, enriched to record full technical metrics:

```sql
CREATE TABLE IF NOT EXISTS future_ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
    workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
    analysis_type VARCHAR(100) NOT NULL,
    reps INT DEFAULT 0,
    correct_reps INT DEFAULT 0,
    incorrect_reps INT DEFAULT 0,
    form_score NUMERIC(5, 2) DEFAULT NULL,
    mistakes TEXT[] DEFAULT '{}',
    feedback TEXT DEFAULT '',
    model_confidence NUMERIC(5, 2) DEFAULT NULL,
    detected_exercise VARCHAR(100) DEFAULT NULL,
    metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Verification & Automated Test Results

### 1. Model & Inference Service Test (`test_client.py`)
- `/health`: `status: healthy`, `model_loaded: true`, checkpoint: `best_model.pt`.
- `/models`: Loaded 12 classes, `input_dim = 312`.
- `/predict`: Evaluated 60-frame sample in **14.9 ms**.
- **Result: PASS (100%)**

### 2. Master Exercise Library & Backend API Test Suite (`test_api.js`)
- Tested health check, catalog pagination (1,343 exercises), search, custom exercises, user privacy, routine creation, set logging, and 8-week volume history.
- **Result: 11 / 11 tests passed (100% success, zero regressions)**.

### 3. AI Assistance End-to-End Suite (`test_ai_api.js`)
- Tested `/api/ai/health`, `/api/ai/models`, `/api/ai/supported-exercises`, multi-task `/api/ai/predict`, `/api/ai/save-session`, and `/api/ai/history`.
- In-memory execution latency: **10.74 ms**.
- **Result: 6 / 6 tests passed (100% success)**.

### 4. Frontend Production Compilation (`npm run build`)
- Vite production build succeeded in **3.23s** with zero errors.

---

## 7. How to Run the Application

### Prerequisites
- Node.js v18+
- Python 3.12+
- PostgreSQL database running (`fitness_app`)

### Commands

1. **Start Python AI Inference Server**:
   ```bash
   npm run ai:service
   ```
   *Runs on `http://127.0.0.1:8000`*

2. **Start Node.js Backend Server**:
   ```bash
   npm run dev:server
   ```
   *Runs on `http://localhost:5000`*

3. **Start React Vite Client**:
   ```bash
   npm run dev:client
   ```
   *Runs on `http://localhost:5173`*

4. **Access the Application**:
   Open `http://localhost:5173/app/ai-assistance` in your browser.
