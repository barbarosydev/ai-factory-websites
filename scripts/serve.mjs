#!/usr/bin/env node
/**
 * Minimal, zero-dependency loopback static file server for Playwright and local preview.
 * Serves files from --root (default: process.cwd()) on 127.0.0.1:--port (default: 4173).
 *
 * - When SITE_SLUG is set, GET / redirects to /sites/<SITE_SLUG>/index.html so relative CSS/JS work.
 * - When SITE_SLUG is unset, GET / serves the interactive Showcase Portal & Responsive Preview Studio.
 * - Pass --open to launch the URL in your default browser.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { loadSitesCatalog, renderPortalHTML } from './portal-template.mjs';

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
  let openBrowser = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port' && argv[i + 1]) {
      port = Number(argv[++i]);
    } else if (argv[i] === '--root' && argv[i + 1]) {
      root = argv[++i];
    } else if (argv[i] === '--open') {
      openBrowser = true;
    }
  }
  return { port, root: path.resolve(root), openBrowser };
}

const { port, root, openBrowser } = parseArgs(process.argv.slice(2));
const sitesRoot = path.resolve(root, 'sites');
const sitesRealRoot = fs.existsSync(sitesRoot) ? fs.realpathSync(sitesRoot) : sitesRoot;

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  let reqUrl;
  let decodedPath;
  try {
    reqUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    decodedPath = decodeURIComponent(reqUrl.pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  if (decodedPath === '/__health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : 'ok\n');
    return;
  }

  const relPathRaw = decodedPath.replace(/^\/+/, '');
  if (!relPathRaw || relPathRaw === 'index.html') {
    if (process.env.SITE_SLUG) {
      res.writeHead(302, {
        Location: `/sites/${encodeURIComponent(process.env.SITE_SLUG)}/index.html`,
        'Cache-Control': 'no-store',
      });
      res.end();
      return;
    }
    const html = renderPortalHTML(loadSitesCatalog(root, { includeTemplate: false }));
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : html);
    return;
  }

  let relPath = relPathRaw;
  if (relPath.endsWith('/')) {
    relPath += 'index.html';
  }

  const candidate = path.resolve(root, relPath);
  if (!candidate.startsWith(sitesRoot + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  let filePath = candidate;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const realFile = fs.realpathSync(filePath);
  if (!realFile.startsWith(sitesRealRoot + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(realFile).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(realFile).pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Retry with SITE_SERVER_PORT=4174 task preview`);
  } else {
    console.error(`Server error: ${err.message}`);
  }
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}

server.listen(port, '127.0.0.1', () => {
  const url = process.env.SITE_SLUG
    ? `http://127.0.0.1:${port}/sites/${process.env.SITE_SLUG}/index.html`
    : `http://127.0.0.1:${port}/`;
  console.log(`Static server listening at ${url} (root=${root})`);
  if (openBrowser) {
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    const child = spawn(opener, [url], { detached: true, stdio: 'ignore' });
    child.unref();
  }
});
