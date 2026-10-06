import { query } from '../config/db.js';

const MOVIQ_INFERENCE_URL = process.env.MOVIQ_INFERENCE_URL || 'http://127.0.0.1:8000';

// Canonical Core 12 AI Supported Exercises with database search keywords
const CORE_12_SPECS = [
  { key: 'squat', name: 'Squat', patterns: ['Barbell Squat', '%Squat%'], icon: 'squat' },
  { key: 'bench_press', name: 'Bench Press', patterns: ['Barbell Bench Press', '%Bench Press%'], icon: 'bench' },
  { key: 'bicep_curl', name: 'Bicep Curl', patterns: ['Barbell Curl', '%Bicep Curl%', '%Dumbbell Curl%'], icon: 'bicep' },
  { key: 'shoulder_press', name: 'Shoulder Press', patterns: ['Overhead Press (OHP)', '%Shoulder Press%'], icon: 'shoulder' },
  { key: 'lateral_raise', name: 'Lateral Raise', patterns: ['Lateral Raise', '%Dumbbell Lateral Raise%'], icon: 'lateral' },
  { key: 'lat_pulldown', name: 'Lat Pulldown', patterns: ['Lat Pulldown', '%Cable Pulldown%'], icon: 'lat' },
  { key: 'cable_row', name: 'Cable Row', patterns: ['Cable Seated Row', '%Cable Row%', '%Row%'], icon: 'row' },
  { key: 'cable_fly', name: 'Cable Fly', patterns: ['Cable Middle Fly', '%Cable Fly%', '%Fly%'], icon: 'fly' },
  { key: 'chest_press', name: 'Chest Press', patterns: ['Lever Chest Press', '%Chest Press%'], icon: 'chest' },
  { key: 'incline_chest_press', name: 'Incline Chest Press', patterns: ['Cable Incline Bench Press', '%Incline%'], icon: 'incline' },
  { key: 'pec_deck_fly', name: 'Pec Deck Fly', patterns: ['Lever Seated Fly', '%Fly%'], icon: 'pec' },
  { key: 'rear_delt_fly', name: 'Rear Delt Fly', patterns: ['Smith Rear Delt Row', '%Reverse Fly%', '%Rear Delt%'], icon: 'delt' },
];

/**
 * GET /api/ai/health
 * Check Python inference service readiness.
 */
export const getAIHealth = async (req, res, next) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${MOVIQ_INFERENCE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        online: false,
        error: 'AI service returned error',
      });
    }

    const data = await response.json();
    return res.status(200).json({
      success: true,
      online: true,
      ...data,
    });
  } catch (error) {
    return res.status(200).json({
      success: false,
      online: false,
      service: 'mov-iq-inference-service',
      message: 'AI inference service is offline or unreachable.',
      details: error.message,
    });
  }
};

/**
 * GET /api/ai/models
 * Fetch metadata for active model.
 */
export const getAIModels = async (req, res, next) => {
  try {
    const response = await fetch(`${MOVIQ_INFERENCE_URL}/models`, { method: 'GET' });
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: 'Could not fetch model metadata' });
    }
    const data = await response.json();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: 'AI Model service unavailable',
      details: error.message,
    });
  }
};

/**
 * POST /api/ai/predict
 * Proxy landmark/feature sequences to the Python inference server.
 */
export const predictPose = async (req, res, next) => {
  try {
    const { landmarks, features, fps = 30.0, exercise_hint } = req.body;

    if (!landmarks && !features) {
      return res.status(400).json({
        success: false,
        error: 'Either landmarks [T, 33, 3] or features [T, 312] must be provided.',
      });
    }

    const payload = {
      fps: Number(fps) || 30.0,
      ...(landmarks ? { landmarks } : {}),
      ...(features ? { features } : {}),
      ...(exercise_hint ? { exercise_hint } : {}),
    };

    const response = await fetch(`${MOVIQ_INFERENCE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error || 'Prediction failed',
        message: data.message,
      });
    }

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: 'Failed to communicate with AI inference engine',
      details: error.message,
    });
  }
};

/**
 * GET /api/ai/supported-exercises
 * Return list of the 12 core exercises with their mapped database records.
 */
export const getSupportedExercises = async (req, res, next) => {
  try {
    const exercisesList = [];

    for (const spec of CORE_12_SPECS) {
      let dbMatch = null;
      for (const pat of spec.patterns) {
        const queryRes = await query(
          `SELECT id, name, category, body_part, equipment, target_muscle, 
                  instructions, thumbnail_url, animation_url, difficulty
           FROM exercises 
           WHERE name ILIKE $1 
           ORDER BY LENGTH(name) ASC 
           LIMIT 1`,
          [pat]
        );
        if (queryRes.rows.length > 0) {
          dbMatch = queryRes.rows[0];
          break;
        }
      }

      exercisesList.push({
        model_key: spec.key,
        display_name: spec.name,
        is_ai_supported: true,
        db_exercise: dbMatch,
      });
    }

    return res.status(200).json({
      success: true,
      count: exercisesList.length,
      data: exercisesList,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/save-session
 * Save AI Assistance session results into future_ai_analysis table.
 */
export const saveAISession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      exercise_id,
      workout_id = null,
      analysis_type = 'ai_assistance_live',
      reps = 0,
      correct_reps = 0,
      incorrect_reps = 0,
      form_score = 0,
      mistakes = [],
      feedback = '',
      model_confidence = null,
      detected_exercise = null,
      metrics = {},
    } = req.body;

    const insertRes = await query(
      `INSERT INTO future_ai_analysis 
        (user_id, exercise_id, workout_id, analysis_type, reps, correct_reps, 
         incorrect_reps, form_score, mistakes, feedback, model_confidence, 
         detected_exercise, metrics, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       RETURNING *`,
      [
        userId,
        exercise_id || null,
        workout_id || null,
        analysis_type,
        Number(reps) || 0,
        Number(correct_reps) || 0,
        Number(incorrect_reps) || 0,
        form_score != null ? Number(form_score) : null,
        Array.isArray(mistakes) ? mistakes : [],
        feedback || '',
        model_confidence != null ? Number(model_confidence) : null,
        detected_exercise || null,
        metrics ? JSON.stringify(metrics) : '{}',
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'AI Assistance session saved successfully.',
      data: insertRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ai/history
 * Fetch past AI sessions for the authenticated athlete.
 */
export const getAIHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const historyRes = await query(
      `SELECT a.*, e.name as exercise_name, e.thumbnail_url, e.body_part, e.equipment
       FROM future_ai_analysis a
       LEFT JOIN exercises e ON a.exercise_id = e.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      count: historyRes.rowCount,
      data: historyRes.rows,
    });
  } catch (error) {
    next(error);
  }
};
