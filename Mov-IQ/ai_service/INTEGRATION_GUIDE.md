# MOV-IQ Frontend & Backend Integration Guide

This guide is for frontend or full-stack developers integrating MOV-IQ pose analysis into an existing application.

---

## Architecture Overview

```
[Browser / Mobile App]
  (MediaPipe JS extracts 33 landmarks)
        │
        │  POST /api/workout/analyze (or direct)
        ▼
[Node.js / Express Backend]  ─── HTTP Proxy ───►  [MOV-IQ Inference Service (Port 8000)]
        ▲                                                │
        └──────────────── JSON Response ─────────────────┘
```

---

## Pattern 1: Proxy via Node.js / Express Backend (Recommended)

In your existing Node.js server:

```javascript
// routes/workout.js
const express = require('express');
const router = express.Router();

const MOVIQ_URL = process.env.MOVIQ_URL || 'http://127.0.0.1:8000';

router.post('/analyze-form', async (req, res) => {
  try {
    const { landmarks, fps, exerciseHint } = req.body;

    const response = await fetch(`${MOVIQ_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        landmarks: landmarks,
        fps: fps || 30.0,
        exercise_hint: exerciseHint,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json(err);
    }

    const data = await response.json();
    return res.json({
      exercise: data.exercise.prediction,
      exerciseConfidence: data.exercise.confidence,
      formStatus: data.form.prediction, // "proper_form" | "incorrect_form"
      formConfidence: data.form.confidence,
      feedback: data.form.prediction === 'proper_form'
        ? 'Great form! Maintain your posture through the full range of motion.'
        : 'Form breakdown detected. Check bar path and joint alignment.',
      inferenceTimeMs: data.inference_time_ms,
    });
  } catch (error) {
    console.error('MOV-IQ analysis failed:', error);
    return res.status(500).json({ error: 'Failed to analyze exercise form.' });
  }
});

module.exports = router;
```

---

## Pattern 2: Direct Browser Fetch (CORS Enabled)

The MOV-IQ service has built-in CORS headers (`Access-Control-Allow-Origin: *`):

```javascript
async function analyzeRecordedClip(landmarkFrames) {
  const res = await fetch('http://127.0.0.1:8000/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      landmarks: landmarkFrames, // [T, 33, 3]
      fps: 30.0,
    }),
  });

  const analysis = await res.json();
  console.log('Exercise:', analysis.exercise.prediction);
  console.log('Form:', analysis.form.prediction);
  return analysis;
}
```

---

## Deployment & Production Run

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run server
python server.py --host 0.0.0.0 --port 8000
```
