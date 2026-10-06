import { query } from '../config/db.js';

// GET /api/routines (List all routines for authenticated user)
export const getRoutines = async (req, res, next) => {
  try {
    const routinesRes = await query(
      `SELECT r.id, r.name, r.description, r.created_at, r.updated_at,
              COUNT(re.id)::int as exercise_count
       FROM routines r
       LEFT JOIN routine_exercises re ON r.id = re.routine_id
       WHERE r.user_id = $1
       GROUP BY r.id
       ORDER BY r.updated_at DESC;`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      count: routinesRes.rowCount,
      data: routinesRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/routines/:id (Get single routine with its exercises)
export const getRoutineById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify routine belongs to authenticated user
    const routineRes = await query(
      `SELECT * FROM routines WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (routineRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Routine not found or you do not have permission to view it.',
      });
    }

    const routine = routineRes.rows[0];

    // Fetch associated exercises
    const exercisesRes = await query(
      `SELECT re.id as routine_exercise_id, re.order_index, re.target_sets, 
              re.target_reps, re.target_weight, re.rest_seconds, re.notes,
              e.id as exercise_id, e.name, e.equipment, e.primary_muscles, 
              e.secondary_muscles, e.thumbnail, e.difficulty, e.exercise_type
       FROM routine_exercises re
       JOIN exercises e ON re.exercise_id = e.id
       WHERE re.routine_id = $1
       ORDER BY re.order_index ASC;`,
      [id]
    );

    routine.exercises = exercisesRes.rows;

    return res.status(200).json({
      success: true,
      data: routine,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/routines (Create a new routine)
export const createRoutine = async (req, res, next) => {
  try {
    const { name, description = '', exercises = [] } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Routine name is required.' });
    }

    // Insert Routine
    const routineRes = await query(
      `INSERT INTO routines (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *;`,
      [req.user.id, name.trim(), description]
    );

    const createdRoutine = routineRes.rows[0];

    // Insert routine exercises if any
    const createdExercises = [];
    if (Array.isArray(exercises) && exercises.length > 0) {
      for (let i = 0; i < exercises.length; i++) {
        const item = exercises[i];
        const reRes = await query(
          `INSERT INTO routine_exercises (
            routine_id, exercise_id, order_index, target_sets, target_reps, target_weight, rest_seconds, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *;`,
          [
            createdRoutine.id,
            item.exercise_id,
            item.order_index !== undefined ? item.order_index : i,
            item.target_sets || 3,
            item.target_reps || 10,
            item.target_weight || 0.0,
            item.rest_seconds || 90,
            item.notes || '',
          ]
        );
        createdExercises.push(reRes.rows[0]);
      }
    }

    createdRoutine.exercises = createdExercises;

    return res.status(201).json({
      success: true,
      message: 'Routine created successfully.',
      data: createdRoutine,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/routines/:id (Update a routine and its exercises)
export const updateRoutine = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, exercises } = req.body;

    // Check ownership
    const checkRes = await query(
      `SELECT id FROM routines WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (checkRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Routine not found or you do not have permission to modify it.',
      });
    }

    const updateRes = await query(
      `UPDATE routines
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4
       RETURNING *;`,
      [name, description, id, req.user.id]
    );

    const updatedRoutine = updateRes.rows[0];

    // If exercises array is provided, replace routine exercises
    if (Array.isArray(exercises)) {
      await query(`DELETE FROM routine_exercises WHERE routine_id = $1`, [id]);

      const updatedExercises = [];
      for (let i = 0; i < exercises.length; i++) {
        const item = exercises[i];
        const reRes = await query(
          `INSERT INTO routine_exercises (
            routine_id, exercise_id, order_index, target_sets, target_reps, target_weight, rest_seconds, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *;`,
          [
            id,
            item.exercise_id,
            item.order_index !== undefined ? item.order_index : i,
            item.target_sets || 3,
            item.target_reps || 10,
            item.target_weight || 0.0,
            item.rest_seconds || 90,
            item.notes || '',
          ]
        );
        updatedExercises.push(reRes.rows[0]);
      }
      updatedRoutine.exercises = updatedExercises;
    }

    return res.status(200).json({
      success: true,
      message: 'Routine updated successfully.',
      data: updatedRoutine,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/routines/:id
export const deleteRoutine = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleteRes = await query(
      `DELETE FROM routines WHERE id = $1 AND user_id = $2 RETURNING id;`,
      [id, req.user.id]
    );

    if (deleteRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Routine not found or you do not have permission to delete it.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Routine deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
