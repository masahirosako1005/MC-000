import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number.parseInt(process.env.PORT || '3000', 10);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (!req.url) return send(res, 400, 'Bad Request');
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/revisit/' });
    return res.end();
  }

  if (!url.pathname.startsWith('/revisit')) return send(res, 404, 'Not Found');

  let relative = decodeURIComponent(url.pathname.slice('/revisit'.length));
  if (!relative || relative === '/') relative = '/index.html';
  const target = path.resolve(root, `.${relative}`);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    return send(res, 403, 'Forbidden');
  }

  try {
    const info = await stat(target);
    const file = info.isDirectory() ? path.join(target, 'index.html') : target;
    const data = await readFile(file);
    send(res, 200, data, types[path.extname(file).toLowerCase()] || 'application/octet-stream');
  } catch (error) {
    if (error.code === 'ENOENT') return send(res, 404, 'Not Found');
    console.error(error);
    send(res, 500, 'Internal Server Error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`旅のつづきミッション: http://localhost:${port}/revisit/`);
});
