import crypto from 'crypto';

// Internal secret for Puppeteer PDF rendering to bypass auth
export const INTERNAL_SECRET = crypto.randomBytes(32).toString('hex');

export function requireAuth(req, res, next) {
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
