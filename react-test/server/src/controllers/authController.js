import pool from '../db/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function register(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!password || !password.trim()) {
      return res.status(400).json({ message: 'Password is required' });
    }
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.trim().toLowerCase()],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, created_at
      `,
      [email.trim().toLowerCase(), passwordHash],
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' },
    );

    res.status(201).json({
      user,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to register' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ message: 'Password is required' });
    }
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [
      email.trim().toLowerCase(),
    ]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' },
    );
    res.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      token,
    });
  } catch (error) {}
}
