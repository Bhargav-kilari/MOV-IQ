import { query } from '../config/db.js';

// GET /api/users/profile
export const getProfile = async (req, res, next) => {
  try {
    const userRes = await query(
      `SELECT id, name, email, profile_picture, fitness_goal, experience_level, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      data: { user: userRes.rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/profile
export const updateProfile = async (req, res, next) => {
  try {
    const { name, fitness_goal, experience_level, profile_picture } = req.body;

    const updateRes = await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           fitness_goal = COALESCE($2, fitness_goal),
           experience_level = COALESCE($3, experience_level),
           profile_picture = COALESCE($4, profile_picture),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, name, email, profile_picture, fitness_goal, experience_level, created_at, updated_at;`,
      [name, fitness_goal, experience_level, profile_picture, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user: updateRes.rows[0] },
    });
  } catch (error) {
    next(error);
  }
};
