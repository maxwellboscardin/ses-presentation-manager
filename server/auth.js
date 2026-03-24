import crypto from 'crypto';
import { pool } from './db.js';

// Internal secret for Puppeteer PDF rendering to bypass auth
export const INTERNAL_SECRET = crypto.randomBytes(32).toString('hex');

// Cache the auth_enabled setting (check DB at most every 30s)
let authEnabled = true;
let lastCheck = 0;
const CHECK_INTERVAL = 30_000;

async function isAuthEnabled() {
  const now = Date.now();
  if (now - lastCheck < CHECK_INTERVAL) return authEnabled;
  lastCheck = now;
  try {
    const { rows } = await pool.query(
      "SELECT auth_enabled FROM service_settings WHERE service_name = 'presentations'"
    );
    if (rows.length) authEnabled = rows[0].auth_enabled;
  } catch {
    // If DB query fails, keep current value (safe default: true)
  }
  return authEnabled;
}

export async function requireAuth(req, res, next) {
  // Check if auth is disabled for this service
  if (!(await isAuthEnabled())) return next();

  // Allow internal Puppeteer requests (localhost + secret header)
  if (req.headers['x-pdf-internal'] === INTERNAL_SECRET) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      return next();
    }
  }

  if (req.session?.user) return next();

  // API/fetch requests get 401 JSON
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Browser requests redirect to login
  res.redirect('/login');
}
