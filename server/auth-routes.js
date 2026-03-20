import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const router = Router();
const SERVICE_ID = 'presentations';

function logActivity(userId, username, displayName, action, ip) {
  pool.query(
    'INSERT INTO activity_log (user_id, username, display_name, action, service, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, username, displayName, action, SERVICE_ID, ip]
  ).catch(() => {});
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username.toLowerCase().trim()]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check service permission
    if (Array.isArray(user.allowed_services) && !user.allowed_services.includes(SERVICE_ID)) {
      logActivity(user.id, user.username, user.display_name, 'login_denied', req.ip);
      return res.status(403).json({ error: 'You do not have access to this service' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      must_change_password: user.must_change_password,
    };

    logActivity(user.id, user.username, user.display_name, 'login', req.ip);
    res.json({ user: req.session.user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const u = req.session?.user;
  if (u) logActivity(u.id, u.username, u.display_name, 'logout', req.ip);
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.session.user });
});

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const user = rows[0];

    if (!user.must_change_password) {
      if (!current_password) return res.status(400).json({ error: 'Current password required' });
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, password_plain = $2, must_change_password = false WHERE id = $3',
      [hash, new_password, user.id]
    );
    req.session.user.must_change_password = false;
    logActivity(user.id, user.username, user.display_name, 'password_change', req.ip);
    res.json({ ok: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
