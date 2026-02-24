import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, resolve } from 'path';

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

createServer(async (req, res) => {
  let path = req.url.split('?')[0];
  if (path === '/') path = '/output/1258-flipbook.html';

  const filePath = join(ROOT, path);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Serving on port ${PORT}`));
