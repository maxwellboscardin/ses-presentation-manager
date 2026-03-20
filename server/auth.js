export function requireAuth(req, res, next) {
  if (req.session?.user) return next();

  // API/fetch requests get 401 JSON
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Browser requests redirect to login
  res.redirect('/login');
}
