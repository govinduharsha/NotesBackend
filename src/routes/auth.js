import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

router.post('/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    try {
      const hash = await bcrypt.hash(password, 10);
      await query('INSERT INTO users (email, password_hash) VALUES ($1, $2)', [email, hash]);
      res.status(201).json({ message: 'User created' });
    } catch (err) {
      if (err.code === '23505') return res.status(400).json({ message: 'Email already registered' });
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  }
);

router.post('/login',
  body('email').isEmail(),
  body('password').exists(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    try {
      const result = await query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) return res.status(401).json({ message: 'Invalid email or password' });
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ message: 'Invalid email or password' });
      const token = jwt.sign({ sub: String(user.id), email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ access_token: token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  }
);

export default router;
