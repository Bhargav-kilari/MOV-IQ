import { query } from '../config/db.js';

// Curated Popular Exercise Search Terms for default Popular Tab
const POPULAR_KEYWORDS = [
  'Barbell Bench Press',
  'Barbell Squat',
  'Conventional Deadlift',
  'Overhead Press (OHP)',
  'Pull-Up',
  'Dumbbell Bicep Curl',
  'Incline Dumbbell Press',
  'Tricep Rope Pushdown',
  'Lateral Raise',
  'Lat Pulldown',
  'Dumbbell Bench Press',
  'Barbell Row',
  'Leg Press',
  'Romanian Deadlift',
  'Dumbbell Shoulder Press',
  'Cable Crossover',
  'Hammer Curl',
  'Dips',
  'Hanging Leg Raise',
  'Seated Cable Row',
];

// GET /api/exercises
export const getExercises = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 30,
      search,
      body_part,
      equipment,
      target_muscle,
      category,
      tab = 'all',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    const userId = req.user ? req.user.id : null;
    const params = [];
    let whereClauses = [];

    // Global vs Custom Isolation
    if (tab === 'custom') {
      if (!userId) {
        return res.status(200).json({
          success: true,
          count: 0,
          total: 0,
          page: pageNum,
          totalPages: 0,
          data: [],
        });
      }
      params.push(userId);
      whereClauses.push(`is_custom = true AND user_id = $${params.length}`);
    } else if (userId) {
      params.push(userId);
      whereClauses.push(`(is_custom = false OR (is_custom = true AND user_id = $${params.length}))`);
    } else {
      whereClauses.push(`is_custom = false`);
    }

    // Popular Tab Filter
    if (tab === 'popular' && (!search || search.trim() === '')) {
      const keywordList = POPULAR_KEYWORDS.map((k) => `%${k.toLowerCase()}%`);
      params.push(keywordList);
      whereClauses.push(`LOWER(name) ILIKE ANY($${params.length})`);
    }

    // Search Query (across name, target_muscle, body_part, equipment)
    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      const sIdx = params.length;
      whereClauses.push(`(
        LOWER(name) LIKE $${sIdx} OR
        LOWER(COALESCE(target_muscle, '')) LIKE $${sIdx} OR
        LOWER(COALESCE(body_part, '')) LIKE $${sIdx} OR
        LOWER(COALESCE(equipment, '')) LIKE $${sIdx} OR
        LOWER(COALESCE(category, '')) LIKE $${sIdx}
      )`);
    }

    // Body Part Filter
    if (body_part && body_part !== 'All') {
      params.push(body_part.toLowerCase().trim());
      whereClauses.push(`LOWER(body_part) = $${params.length}`);
    }

    // Equipment Filter
    if (equipment && equipment !== 'All') {
      params.push(equipment.toLowerCase().trim());
      whereClauses.push(`LOWER(equipment) = $${params.length}`);
    }

    // Target Muscle Filter
    if (target_muscle && target_muscle !== 'All') {
      params.push(target_muscle.toLowerCase().trim());
      whereClauses.push(`LOWER(target_muscle) = $${params.length}`);
    }

    // Category Filter
    if (category && category !== 'All') {
      params.push(category.toLowerCase().trim());
      whereClauses.push(`LOWER(category) = $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count Total Matching Records
    const countSql = `SELECT COUNT(*)::int as total FROM exercises ${whereSql};`;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    // Fetch Paginated Results
    params.push(limitNum);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataSql = `
      SELECT id, external_id, name, category, body_part, equipment,
             target_muscle, secondary_muscles, instructions,
             thumbnail_url, animation_url, media_attribution,
             difficulty, exercise_type, is_custom, user_id, created_at
      FROM exercises
      ${whereSql}
      ORDER BY 
        CASE WHEN is_custom = true THEN 0 ELSE 1 END ASC,
        name ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const dataRes = await query(dataSql, params);

    return res.status(200).json({
      success: true,
      count: dataRes.rowCount,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: dataRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/exercises/filters (Get unique body parts, equipment, target muscles)
export const getExerciseFilters = async (req, res, next) => {
  try {
    const bodyPartsRes = await query(`
      SELECT DISTINCT body_part, COUNT(*)::int as count
      FROM exercises
      WHERE body_part IS NOT NULL AND body_part != ''
      GROUP BY body_part
      ORDER BY body_part ASC;
    `);

    const equipmentRes = await query(`
      SELECT DISTINCT equipment, COUNT(*)::int as count
      FROM exercises
      WHERE equipment IS NOT NULL AND equipment != ''
      GROUP BY equipment
      ORDER BY equipment ASC;
    `);

    const targetMusclesRes = await query(`
      SELECT DISTINCT target_muscle, COUNT(*)::int as count
      FROM exercises
      WHERE target_muscle IS NOT NULL AND target_muscle != ''
      GROUP BY target_muscle
      ORDER BY target_muscle ASC;
    `);

    return res.status(200).json({
      success: true,
      data: {
        body_parts: bodyPartsRes.rows,
        equipment: equipmentRes.rows,
        target_muscles: targetMusclesRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/exercises/recent (Recently performed exercises for authenticated user)
export const getRecentExercises = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(200).json({ success: true, data: [] });
    }

    const recentRes = await query(
      `SELECT DISTINCT ON (e.id)
              e.id, e.external_id, e.name, e.category, e.body_part, e.equipment,
              e.target_muscle, e.secondary_muscles, e.thumbnail_url, e.animation_url,
              e.media_attribution, e.difficulty, e.is_custom,
              w.started_at as last_performed
       FROM workout_exercises we
       JOIN workouts w ON we.workout_id = w.id
       JOIN exercises e ON we.exercise_id = e.id
       WHERE w.user_id = $1
       ORDER BY e.id, w.started_at DESC
       LIMIT 8;`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      data: recentRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/exercises/:id (Get single exercise with personal records and history)
export const getExerciseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;

    const exRes = await query(
      `SELECT * FROM exercises 
       WHERE id = $1 AND (is_custom = false OR user_id = $2 OR $2 IS NULL);`,
      [id, userId]
    );

    if (exRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Exercise not found.' });
    }

    const exercise = exRes.rows[0];

    // If user is authenticated, compute Personal Records & History
    let personalRecords = { pr_weight: 0, pr_estimated_1rm: 0, pr_single_set_volume: 0 };
    let history = [];

    if (userId) {
      const prRes = await query(
        `SELECT MAX(ws.weight)::numeric(6,2) as pr_weight,
                MAX(ROUND(ws.weight * (1 + ws.reps::numeric / 30), 2)) as pr_estimated_1rm,
                COALESCE(MAX(ws.weight * ws.reps), 0)::numeric(10,2) as pr_single_set_volume
         FROM workouts w
         JOIN workout_exercises we ON w.id = we.workout_id
         JOIN workout_sets ws ON we.id = ws.workout_exercise_id
         WHERE w.user_id = $1 AND we.exercise_id = $2 AND ws.completed = true;`,
        [userId, id]
      );
      if (prRes.rowCount > 0 && prRes.rows[0].pr_weight !== null) {
        personalRecords = prRes.rows[0];
      }

      const histRes = await query(
        `SELECT w.id as workout_id,
                w.name as workout_name,
                w.completed_at,
                MAX(ws.weight)::numeric(6,2) as max_weight,
                MAX(ws.reps)::int as max_reps,
                COALESCE(SUM(ws.weight * ws.reps), 0)::numeric(10,2) as session_volume,
                COUNT(ws.id)::int as sets_completed,
                MAX(ROUND(ws.weight * (1 + ws.reps::numeric / 30), 2)) as estimated_one_rep_max
         FROM workouts w
         JOIN workout_exercises we ON w.id = we.workout_id
         JOIN workout_sets ws ON we.id = ws.workout_exercise_id
         WHERE w.user_id = $1 
           AND we.exercise_id = $2 
           AND w.completed_at IS NOT NULL 
           AND ws.completed = true
         GROUP BY w.id, w.name, w.completed_at
         ORDER BY w.completed_at ASC;`,
        [userId, id]
      );
      history = histRes.rows;
    }

    return res.status(200).json({
      success: true,
      data: {
        ...exercise,
        personal_records: personalRecords,
        history,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/exercises/:id/history (User's complete sets history for an exercise)
export const getExerciseHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const historyRes = await query(
      `SELECT w.id as workout_id, w.name as workout_name, w.completed_at,
              json_agg(
                json_build_object(
                  'set_number', ws.set_number,
                  'weight', ws.weight,
                  'reps', ws.reps,
                  'rpe', ws.rpe,
                  'completed', ws.completed
                ) ORDER BY ws.set_number ASC
              ) as sets
       FROM workouts w
       JOIN workout_exercises we ON w.id = we.workout_id
       JOIN workout_sets ws ON we.id = ws.workout_exercise_id
       WHERE w.user_id = $1 AND we.exercise_id = $2 AND w.completed_at IS NOT NULL
       GROUP BY w.id, w.name, w.completed_at
       ORDER BY w.completed_at DESC;`,
      [userId, id]
    );

    return res.status(200).json({
      success: true,
      data: historyRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/exercises/custom (Create custom exercise for authenticated user)
export const createCustomExercise = async (req, res, next) => {
  try {
    const {
      name,
      body_part = 'other',
      equipment = 'body weight',
      target_muscle = 'other',
      secondary_muscles = [],
      instructions = [],
      thumbnail_url = null,
      difficulty = 'Beginner',
      exercise_type = 'Weight & Reps',
    } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Exercise name is required.' });
    }

    const insertRes = await query(
      `INSERT INTO exercises (
        name, category, body_part, equipment, target_muscle,
        secondary_muscles, instructions, thumbnail_url, animation_url,
        media_attribution, difficulty, exercise_type, is_custom, user_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NULL, 'Custom Exercise', $9, $10, true, $11
      )
      RETURNING *;`,
      [
        name.trim(),
        body_part.toLowerCase().trim(),
        body_part.toLowerCase().trim(),
        equipment.toLowerCase().trim(),
        target_muscle.toLowerCase().trim(),
        secondary_muscles,
        instructions,
        thumbnail_url,
        difficulty,
        exercise_type,
        req.user.id,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Custom exercise created successfully.',
      data: insertRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/exercises/custom/:id (Update custom exercise)
export const updateCustomExercise = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      body_part,
      equipment,
      target_muscle,
      secondary_muscles,
      instructions,
      thumbnail_url,
      difficulty,
    } = req.body;

    const checkRes = await query(
      'SELECT id FROM exercises WHERE id = $1 AND is_custom = true AND user_id = $2;',
      [id, req.user.id]
    );

    if (checkRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Custom exercise not found or permission denied.',
      });
    }

    const updateRes = await query(
      `UPDATE exercises
       SET name = COALESCE($1, name),
           body_part = COALESCE($2, body_part),
           category = COALESCE($2, category),
           equipment = COALESCE($3, equipment),
           target_muscle = COALESCE($4, target_muscle),
           secondary_muscles = COALESCE($5, secondary_muscles),
           instructions = COALESCE($6, instructions),
           thumbnail_url = COALESCE($7, thumbnail_url),
           difficulty = COALESCE($8, difficulty),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND is_custom = true AND user_id = $10
       RETURNING *;`,
      [
        name,
        body_part?.toLowerCase().trim(),
        equipment?.toLowerCase().trim(),
        target_muscle?.toLowerCase().trim(),
        secondary_muscles,
        instructions,
        thumbnail_url,
        difficulty,
        id,
        req.user.id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Custom exercise updated successfully.',
      data: updateRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/exercises/custom/:id (Delete custom exercise)
export const deleteCustomExercise = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleteRes = await query(
      'DELETE FROM exercises WHERE id = $1 AND is_custom = true AND user_id = $2 RETURNING id;',
      [id, req.user.id]
    );

    if (deleteRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Custom exercise not found or permission denied.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Custom exercise deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
