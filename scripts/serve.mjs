#!/usr/bin/env node
/**
 * Minimal, zero-dependency loopback static file server for Playwright and local preview.
 * Serves files from --root (default: process.cwd()) on 127.0.0.1:--port (default: 4173).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function parseArgs(argv) {
  let port = Number(process.env.SITE_SERVER_PORT || 4173);
  let root = process.env.SITE_WORKTREE_ROOT || process.cwd();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port' && argv[i + 1]) {
      port = Number(argv[++i]);
    } else if (argv[i] === '--root' && argv[i + 1]) {
      root = argv[++i];
    }
  }
  return { port, root: path.resolve(root) };
}

const { port, root } = parseArgs(process.argv.slice(2));
const sitesRoot = path.resolve(root, 'sites');

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (reqUrl.pathname === '/__health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok\n');
    return;
  }

  let relPath = decodeURIComponent(reqUrl.pathname).replace(/^\/+/, '');
  if (!relPath && process.env.SITE_SLUG) {
    relPath = `sites/${process.env.SITE_SLUG}/index.html`;
  } else if (relPath.endsWith('/')) {
    relPath += 'index.html';
  }

  const candidate = path.resolve(root, relPath);
  if (!candidate.startsWith(sitesRoot + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let filePath = candidate;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  const slug = process.env.SITE_SLUG || '_template';
  console.log(`Static server listening at http://127.0.0.1:${port}/sites/${slug}/index.html (root=${root})`);
});
