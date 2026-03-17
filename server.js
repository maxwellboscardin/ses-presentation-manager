import 'dotenv/config';
import express from 'express';
import { readFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { handleExtract } from './src/pipeline/api-extract.js';

const PORT = process.env.PORT || 8080;
const ROOT = resolve('.');

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
app.use(express.json({ limit: '10mb' }));

// ─── API Routes ──────────────────────────────────────────────
app.post('/api/extract', handleExtract);

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
