import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/connection.js';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { validateRegisterInput, validateLoginInput } from '../middleware/validation.js';

const router = express.Router();

// Apply rate limiting to authentication routes
router.use(authRateLimiter);

// Register
router.post('/register', validateRegisterInput, async (req, res, next) => {
  try {
    const { fullName, email, password, company } = req.body;

    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'An account with this email address already exists.',
        code: 'EMAIL_EXISTS'
      });
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, company)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, company, created_at`,
      [fullName, email, passwordHash, company || null]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        company: user.company
      }
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', validateLoginInput, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Standardize response to reduce email harvesting
      return res.status(401).json({
        error: 'Invalid email or password combination.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid email or password combination.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        company: user.company
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get current profile
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, company, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found.', code: 'USER_NOT_FOUND' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      company: user.company,
      createdAt: user.created_at
    });
  } catch (err) {
    next(err);
  }
});

// Logout endpoint (client discards token)
router.post('/logout', authMiddleware, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
