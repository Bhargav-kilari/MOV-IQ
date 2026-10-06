import { query } from '../config/db.js';

// GET /api/progress (Overall progress overview for authenticated user)
export const getProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Total workouts and duration (Single source of truth from completed workouts)
    const workoutsRes = await query(
      `SELECT 
         COUNT(*)::int as total_workouts,
         COALESCE(SUM(COALESCE(NULLIF(duration, 0), EXTRACT(EPOCH FROM (completed_at - started_at))::int, 0)), 0)::int as total_seconds
       FROM workouts
       WHERE user_id = $1 AND completed_at IS NOT NULL;`,
      [userId]
    );

    // 2. Total volume, completed sets, and reps (Strictly completed sets only)
    const volumeRes = await query(
      `SELECT 
         COALESCE(SUM(ws.weight * ws.reps), 0)::numeric(12, 2) as total_volume_kg,
         COUNT(ws.id)::int as total_completed_sets,
         COALESCE(SUM(ws.reps), 0)::int as total_reps
       FROM workouts w
       JOIN workout_exercises we ON w.id = we.workout_id
       JOIN workout_sets ws ON we.id = ws.workout_exercise_id
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL AND ws.completed = true;`,
      [userId]
    );

    // 3. Exactly 8 Weekly Buckets (Past 7 weeks + current week)
    const weeklyRes = await query(
      `WITH weeks AS (
         SELECT generate_series(
           DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 weeks'),
           DATE_TRUNC('week', CURRENT_DATE),
           INTERVAL '1 week'
         )::date AS week_start
       ),
       user_workouts AS (
         SELECT 
           DATE_TRUNC('week', w.completed_at)::date AS week_start,
           w.id AS workout_id,
           COALESCE(SUM(ws.weight * ws.reps), 0) AS workout_volume
         FROM workouts w
         LEFT JOIN workout_exercises we ON w.id = we.workout_id
         LEFT JOIN workout_sets ws ON we.id = ws.workout_exercise_id AND ws.completed = true
         WHERE w.user_id = $1 AND w.completed_at IS NOT NULL
           AND w.completed_at >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 weeks')
         GROUP BY week_start, w.id
       )
       SELECT 
         w.week_start,
         to_char(w.week_start, 'YYYY-"W"IW') AS week_key,
         to_char(w.week_start, 'Mon DD') AS label,
         COUNT(uw.workout_id)::int AS workout_count,
         COALESCE(SUM(uw.workout_volume), 0)::numeric(12,2) AS weekly_volume
       FROM weeks w
       LEFT JOIN user_workouts uw ON w.week_start = uw.week_start
       GROUP BY w.week_start
       ORDER BY w.week_start ASC;`,
      [userId]
    );

    // 4. Most trained muscle groups (Using target_muscle & body_part)
    const musclesRes = await query(
      `SELECT 
         COALESCE(NULLIF(e.target_muscle, ''), e.body_part, 'General') AS muscle,
         COUNT(ws.id)::int AS set_count,
         COALESCE(SUM(ws.weight * ws.reps), 0)::numeric(12,2) AS muscle_volume
       FROM workouts w
       JOIN workout_exercises we ON w.id = we.workout_id
       JOIN exercises e ON we.exercise_id = e.id
       JOIN workout_sets ws ON we.id = ws.workout_exercise_id
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL AND ws.completed = true
       GROUP BY muscle
       ORDER BY set_count DESC
       LIMIT 6;`,
      [userId]
    );

    // 5. Calculate real consecutive workout days (Active Streak)
    const streakRes = await query(
      `SELECT DISTINCT DATE(completed_at)::text as workout_date
       FROM workouts
       WHERE user_id = $1 AND completed_at IS NOT NULL
       ORDER BY workout_date DESC;`,
      [userId]
    );

    const dates = streakRes.rows.map((r) => r.workout_date);
    let streakDays = 0;
    if (dates.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      const mostRecent = dates[0];
      if (mostRecent === today || mostRecent === yesterday) {
        streakDays = 1;
        let prevDate = new Date(mostRecent);
        for (let i = 1; i < dates.length; i++) {
          prevDate.setDate(prevDate.getDate() - 1);
          const expected = prevDate.toISOString().slice(0, 10);
          if (dates[i] === expected) {
            streakDays++;
          } else {
            break;
          }
        }
      }
    }

    const totalSeconds = workoutsRes.rows[0]?.total_seconds || 0;
    const totalMinutes = Math.round(totalSeconds / 60);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          total_workouts: workoutsRes.rows[0]?.total_workouts || 0,
          total_seconds: totalSeconds,
          total_minutes: totalMinutes,
          total_volume_kg: parseFloat(volumeRes.rows[0]?.total_volume_kg || 0),
          total_completed_sets: volumeRes.rows[0]?.total_completed_sets || 0,
          total_reps: volumeRes.rows[0]?.total_reps || 0,
          streak_days: streakDays,
        },
        weekly_activity: weeklyRes.rows,
        top_muscles: musclesRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/progress/exercises/:exerciseId (Performance history for specific exercise)
export const getExerciseProgress = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    const userId = req.user.id;

    // Check exercise info
    const exRes = await query(
      `SELECT id, name, equipment, body_part, target_muscle, exercise_type 
       FROM exercises 
       WHERE id = $1`,
      [exerciseId]
    );
    if (exRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Exercise not found.' });
    }

    const exercise = exRes.rows[0];

    // Query session progression (1 row per completed workout)
    const historyRes = await query(
      `SELECT w.id as workout_id,
              w.name as workout_name,
              w.completed_at,
              COALESCE(NULLIF(w.duration, 0), EXTRACT(EPOCH FROM (w.completed_at - w.started_at))::int, 0)::int as duration,
              MAX(ws.weight)::numeric(6,2) as max_weight,
              MAX(ws.reps)::int as max_reps,
              COALESCE(SUM(ws.weight * ws.reps), 0)::numeric(12,2) as session_volume,
              COUNT(ws.id)::int as sets_completed,
              -- Epley formula for estimated 1RM: weight * (1 + reps/30)
              MAX(ROUND(ws.weight * (1 + ws.reps::numeric / 30), 2)) as estimated_one_rep_max
       FROM workouts w
       JOIN workout_exercises we ON w.id = we.workout_id
       JOIN workout_sets ws ON we.id = ws.workout_exercise_id
       WHERE w.user_id = $1 
         AND we.exercise_id = $2 
         AND w.completed_at IS NOT NULL 
         AND ws.completed = true
       GROUP BY w.id, w.name, w.completed_at, w.duration, w.started_at
       ORDER BY w.completed_at ASC;`,
      [userId, exerciseId]
    );

    // Personal Records
    const prRes = await query(
      `SELECT MAX(ws.weight)::numeric(6,2) as pr_weight,
              MAX(ROUND(ws.weight * (1 + ws.reps::numeric / 30), 2)) as pr_estimated_1rm,
              COALESCE(MAX(ws.weight * ws.reps), 0)::numeric(12,2) as pr_single_set_volume
       FROM workouts w
       JOIN workout_exercises we ON w.id = we.workout_id
       JOIN workout_sets ws ON we.id = ws.workout_exercise_id
       WHERE w.user_id = $1 AND we.exercise_id = $2 AND w.completed_at IS NOT NULL AND ws.completed = true;`,
      [userId, exerciseId]
    );

    return res.status(200).json({
      success: true,
      data: {
        exercise,
        personal_records: prRes.rows[0] || { pr_weight: 0, pr_estimated_1rm: 0, pr_single_set_volume: 0 },
        history: historyRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};
