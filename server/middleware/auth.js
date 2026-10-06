import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <TOKEN>

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No authentication token provided.',
      });
    }

    const secret = process.env.JWT_SECRET || 'super_secure_jwt_secret_key_fitness_app_2026';
    let decoded;

    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token. Please log in again.',
      });
    }

    // Fetch user details to ensure user still exists
    const userRes = await query(
      'SELECT id, name, email, profile_picture, fitness_goal, experience_level, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userRes.rowCount === 0) {
      return res.status(401).json({
        success: false,
        error: 'User associated with this token no longer exists.',
      });
    }

    req.user = userRes.rows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication.',
    });
  }
};

export const optionalAuthenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const secret = process.env.JWT_SECRET || 'super_secure_jwt_secret_key_fitness_app_2026';
    try {
      const decoded = jwt.verify(token, secret);
      const userRes = await query(
        'SELECT id, name, email, profile_picture, fitness_goal, experience_level, created_at FROM users WHERE id = $1',
        [decoded.userId]
      );
      if (userRes.rowCount > 0) {
        req.user = userRes.rows[0];
      }
    } catch (e) {
      // Ignore token verification error for optional auth
    }
    next();
  } catch (error) {
    next();
  }
};
