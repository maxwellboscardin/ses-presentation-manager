import 'dotenv/config';
import express from 'express';
import { readFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { handleExtract } from './src/pipeline/api-extract.js';
import { initDb } from './src/pipeline/db-init.js';
import { getPool, isDbConfigured } from './src/pipeline/db.js';
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
  '.pdf': 'application/pdf',
};

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

// Initialize database tables
initDb();

// Health check
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

// ─── API Routes ─────────────────────────────────
// PDF generation (5-minute timeout for large collections)
app.use('/api/pdf', (req, res, next) => {
  req.setTimeout(5 * 60 * 1000);
  res.setTimeout(5 * 60 * 1000);
  next();
}, pdfRoutes);

app.post('/api/extract', handleExtract);

// Data values CRUD
app.get('/api/data-values', async (req, res) => {
  if (!isDbConfigured()) {
    return res.json({ rows: [], error: 'Database not configured' });
  }
  try {
    const pipePool = getPool();
    const result = await pipePool.query(
      'SELECT data_point_id, contract_id, value, value_type, source_ingestion_id, updated_by, updated_at FROM data_values ORDER BY updated_at DESC'
    );
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ rows: [], error: err.message });
  }
});

app.put('/api/data-values', async (req, res) => {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  const { dataPointId, contractId, value, valueType, sourceIngestionId } = req.body;
  if (!dataPointId || !contractId || value === undefined) {
    return res.status(400).json({ error: 'Missing required fields: dataPointId, contractId, value' });
  }
  try {
    const pipePool = getPool();
    const result = await pipePool.query(
      `INSERT INTO data_values (data_point_id, contract_id, value, value_type, source_ingestion_id, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (data_point_id, contract_id)
       DO UPDATE SET value = $3, value_type = $4, source_ingestion_id = $5, updated_by = $6, updated_at = NOW()
       RETURNING *`,
      [dataPointId, contractId, JSON.stringify(value), valueType || 'manual', sourceIngestionId || null, 'manual']
    );
    res.json({ ok: true, row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/data-values/:dpId/:contractId', async (req, res) => {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const pipePool = getPool();
    await pipePool.query(
      'DELETE FROM data_values WHERE data_point_id = $1 AND contract_id = $2',
      [req.params.dpId, req.params.contractId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
