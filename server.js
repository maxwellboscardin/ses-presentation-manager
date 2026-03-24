import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { readFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { handleExtract } from './src/pipeline/api-extract.js';
import { initDb } from './src/pipeline/db-init.js';
import { getPool, isDbConfigured } from './src/pipeline/db.js';
import { pool } from './server/db.js';
import { requireAuth } from './server/auth.js';
import authRoutes from './server/auth-routes.js';
import pdfRoutes from './server/pdf-route.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const ROOT = resolve('.');
const isProd = process.env.NODE_ENV === 'production';

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

// Sessions (PostgreSQL-backed)
const PgSession = connectPgSimple(session);
app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// Initialize database tables
initDb();

// --- Unprotected routes ---
app.use('/api/auth', authRoutes);
app.get('/login', (_req, res) => res.sendFile(join(__dirname, 'server', 'login.html')));

// Health check — unprotected so we can verify deployment
app.get('/api/health', async (_req, res) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const hasDb = isDbConfigured();
  if (!hasKey) return res.json({ ok: false, error: 'ANTHROPIC_API_KEY not set', db: hasDb });
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();
    const r = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say OK' }],
    });
    res.json({ ok: true, model: 'haiku', response: r.content[0]?.text, db: hasDb });
  } catch (e) {
    res.json({ ok: false, error: e.message, status: e.status, db: hasDb });
  }
});

// --- Auth wall ---
app.use(requireAuth);

// ─── API Routes (protected) ─────────────────────────────────
// PDF generation (5-minute timeout for large collections)
app.use('/api/pdf', (req, res, next) => {
  req.setTimeout(5 * 60 * 1000);
  res.setTimeout(5 * 60 * 1000);
  next();
}, pdfRoutes);

app.post('/api/extract', handleExtract);

// Ingestion history
app.get('/api/ingestions', async (req, res) => {
  if (!isDbConfigured()) {
    return res.json({ rows: [], error: 'Database not configured' });
  }
  try {
    const pool = getPool();
    const { collection } = req.query;
    let query = 'SELECT id, collection, data_point_id, contract_id, input_type, extracted_value, model_used, confidence, reasoning, created_at FROM ingestion_inputs';
    const params = [];
    if (collection) {
      query += ' WHERE collection = $1';
      params.push(collection);
    }
    query += ' ORDER BY created_at DESC LIMIT 100';
    const result = await pool.query(query, params);
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ rows: [], error: err.message });
  }
});

// ─── Static File Serving (same logic as before) ──────────────
app.get('{*path}', async (req, res) => {
  let path = req.path;
  if (path === '/') path = '/output/index.html';

  const filePath = join(ROOT, path);
  if (!filePath.startsWith(ROOT)) return res.status(403).send('Forbidden');

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.set('Content-Type', MIME[ext] || 'application/octet-stream');
    res.send(data);
  } catch {
    // Fallback: try under /output/
    try {
      const outputPath = join(ROOT, 'output', path);
      if (!outputPath.startsWith(ROOT)) return res.status(403).send('Forbidden');
      const data = await readFile(outputPath);
      const ext = extname(outputPath);
      res.set('Content-Type', MIME[ext] || 'application/octet-stream');
      res.send(data);
    } catch {
      res.status(404).send('Not found');
    }
  }
});

app.listen(PORT, () => console.log(`Serving on port ${PORT}`));
