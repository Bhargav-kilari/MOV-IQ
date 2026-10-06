import { query } from '../config/db.js';

// GET /api/workouts (List user workouts)
export const getWorkouts = async (req, res, next) => {
  try {
    const workoutsRes = await query(
      `SELECT w.id, w.name, w.routine_id, w.started_at, w.completed_at,
              COALESCE(NULLIF(w.duration, 0), EXTRACT(EPOCH FROM (w.completed_at - w.started_at))::int, 0)::int as duration,
              w.notes,
              COUNT(DISTINCT we.id)::int as exercise_count,
              COALESCE(SUM(ws.weight * ws.reps), 0)::numeric(12,2) as total_volume,
              COUNT(ws.id)::int as completed_sets
       FROM workouts w
       LEFT JOIN workout_exercises we ON w.id = we.workout_id
       LEFT JOIN workout_sets ws ON we.id = ws.workout_exercise_id AND ws.completed = true
       WHERE w.user_id = $1
       GROUP BY w.id
       ORDER BY COALESCE(w.completed_at, w.started_at) DESC;`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      count: workoutsRes.rowCount,
      data: workoutsRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/workouts/:id (Get full workout with exercises and sets)
export const getWorkoutById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify workout belongs to user
    const workoutRes = await query(
      `SELECT * FROM workouts WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (workoutRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workout not found or you do not have permission to view it.',
      });
    }

    const workout = workoutRes.rows[0];

    // Fetch exercises for this workout
    const exercisesRes = await query(
      `SELECT we.id as workout_exercise_id, we.order_index, we.notes,
              e.id as exercise_id, e.name, e.equipment, e.primary_muscles,
              e.secondary_muscles, e.thumbnail, e.exercise_type
       FROM workout_exercises we
       JOIN exercises e ON we.exercise_id = e.id
       WHERE we.workout_id = $1
       ORDER BY we.order_index ASC;`,
      [id]
    );

    const exercises = exercisesRes.rows;

    // Fetch sets for all exercises in this workout
    for (const ex of exercises) {
      const setsRes = await query(
        `SELECT id as set_id, set_number, weight, reps, duration, completed, rpe, created_at
         FROM workout_sets
         WHERE workout_exercise_id = $1
         ORDER BY set_number ASC;`,
        [ex.workout_exercise_id]
      );
      ex.sets = setsRes.rows;
    }

    workout.exercises = exercises;

    return res.status(200).json({
      success: true,
      data: workout,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/workouts (Start a new workout)
export const createWorkout = async (req, res, next) => {
  try {
    const { name, routine_id = null, notes = '', exercises = [] } = req.body;

    const workoutName = name && name.trim() !== '' 
      ? name.trim() 
      : `Workout on ${new Date().toLocaleDateString()}`;

    // Insert workout
    const workoutRes = await query(
      `INSERT INTO workouts (user_id, routine_id, name, notes, started_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING *;`,
      [req.user.id, routine_id, workoutName, notes]
    );

    const createdWorkout = workoutRes.rows[0];
    const createdExercises = [];

    // If starting from a routine and exercises weren't explicitly passed in payload
    if (routine_id && (!exercises || exercises.length === 0)) {
      const routineExRes = await query(
        `SELECT * FROM routine_exercises WHERE routine_id = $1 ORDER BY order_index ASC`,
        [routine_id]
      );

      for (let i = 0; i < routineExRes.rowCount; i++) {
        const re = routineExRes.rows[i];
        const weRes = await query(
          `INSERT INTO workout_exercises (workout_id, exercise_id, order_index, notes)
           VALUES ($1, $2, $3, $4)
           RETURNING *;`,
          [createdWorkout.id, re.exercise_id, i, re.notes]
        );

        const we = weRes.rows[0];
        const sets = [];

        // Pre-create target sets
        for (let s = 1; s <= (re.target_sets || 3); s++) {
          const wsRes = await query(
            `INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, completed)
             VALUES ($1, $2, $3, $4, false)
             RETURNING *;`,
            [we.id, s, re.target_weight || 0, re.target_reps || 10]
          );
          sets.push(wsRes.rows[0]);
        }

        we.sets = sets;
        createdExercises.push(we);
      }
    } else if (Array.isArray(exercises) && exercises.length > 0) {
      // Custom exercises provided
      for (let i = 0; i < exercises.length; i++) {
        const item = exercises[i];
        const weRes = await query(
          `INSERT INTO workout_exercises (workout_id, exercise_id, order_index, notes)
           VALUES ($1, $2, $3, $4)
           RETURNING *;`,
          [createdWorkout.id, item.exercise_id, item.order_index !== undefined ? item.order_index : i, item.notes || '']
        );

        const we = weRes.rows[0];
        const sets = [];

        if (Array.isArray(item.sets) && item.sets.length > 0) {
          for (let s = 0; s < item.sets.length; s++) {
            const setObj = item.sets[s];
            const wsRes = await query(
              `INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, duration, completed, rpe)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING *;`,
              [
                we.id,
                setObj.set_number || s + 1,
                setObj.weight || 0,
                setObj.reps || 0,
                setObj.duration || 0,
                setObj.completed || false,
                setObj.rpe || null,
              ]
            );
            sets.push(wsRes.rows[0]);
          }
        }

        we.sets = sets;
        createdExercises.push(we);
      }
    }

    createdWorkout.exercises = createdExercises;

    return res.status(201).json({
      success: true,
      message: 'Workout started successfully.',
      data: createdWorkout,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/workouts/:id (Update workout in progress)
export const updateWorkout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, notes, duration, exercises } = req.body;

    // Check ownership
    const checkRes = await query(
      `SELECT id FROM workouts WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (checkRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workout not found or permission denied.',
      });
    }

    const updateRes = await query(
      `UPDATE workouts
       SET name = COALESCE($1, name),
           notes = COALESCE($2, notes),
           duration = COALESCE($3, duration)
       WHERE id = $4 AND user_id = $5
       RETURNING *;`,
      [name, notes, duration, id, req.user.id]
    );

    const updatedWorkout = updateRes.rows[0];

    // If exercises array is provided, update or replace workout exercises and sets
    if (Array.isArray(exercises)) {
      await query(`DELETE FROM workout_exercises WHERE workout_id = $1`, [id]);

      const updatedExercises = [];
      for (let i = 0; i < exercises.length; i++) {
        const item = exercises[i];
        const weRes = await query(
          `INSERT INTO workout_exercises (workout_id, exercise_id, order_index, notes)
           VALUES ($1, $2, $3, $4)
           RETURNING *;`,
          [id, item.exercise_id, item.order_index !== undefined ? item.order_index : i, item.notes || '']
        );

        const we = weRes.rows[0];
        const sets = [];

        if (Array.isArray(item.sets)) {
          for (let s = 0; s < item.sets.length; s++) {
            const setObj = item.sets[s];
            const wsRes = await query(
              `INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, duration, completed, rpe)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING *;`,
              [
                we.id,
                setObj.set_number || s + 1,
                setObj.weight || 0,
                setObj.reps || 0,
                setObj.duration || 0,
                setObj.completed !== undefined ? setObj.completed : true,
                setObj.rpe || null,
              ]
            );
            sets.push(wsRes.rows[0]);
          }
        }

        we.sets = sets;
        updatedExercises.push(we);
      }
      updatedWorkout.exercises = updatedExercises;
    }

    return res.status(200).json({
      success: true,
      message: 'Workout updated successfully.',
      data: updatedWorkout,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/workouts/:id/complete (Finish workout)
export const completeWorkout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { duration, notes, exercises } = req.body;

    const checkRes = await query(
      `SELECT * FROM workouts WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (checkRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workout not found or permission denied.',
      });
    }

    // Optional update of exercises/sets on completion
    if (Array.isArray(exercises)) {
      await query(`DELETE FROM workout_exercises WHERE workout_id = $1`, [id]);
      for (let i = 0; i < exercises.length; i++) {
        const item = exercises[i];
        const weRes = await query(
          `INSERT INTO workout_exercises (workout_id, exercise_id, order_index, notes)
           VALUES ($1, $2, $3, $4)
           RETURNING id;`,
          [id, item.exercise_id, i, item.notes || '']
        );
        const weId = weRes.rows[0].id;

        if (Array.isArray(item.sets)) {
          for (let s = 0; s < item.sets.length; s++) {
            const setObj = item.sets[s];
            await query(
              `INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps, duration, completed, rpe)
               VALUES ($1, $2, $3, $4, $5, $6, $7);`,
              [
                weId,
                setObj.set_number || s + 1,
                setObj.weight || 0,
                setObj.reps || 0,
                setObj.duration || 0,
                setObj.completed !== undefined ? setObj.completed : true,
                setObj.rpe || null,
              ]
            );
          }
        }
      }
    }

    const currentWorkout = checkRes.rows[0];
    const startedAt = new Date(currentWorkout.started_at);
    const now = new Date();
    const computedDuration = duration || Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 1000));

    const finishRes = await query(
      `UPDATE workouts
       SET completed_at = CURRENT_TIMESTAMP,
           duration = $1,
           notes = COALESCE($2, notes)
       WHERE id = $3 AND user_id = $4
       RETURNING *;`,
      [computedDuration, notes, id, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Workout completed and logged successfully!',
      data: finishRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};
