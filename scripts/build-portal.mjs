#!/usr/bin/env node
/**
 * Build a self-contained static Showcase Portal in dist/ (ready for GitHub Pages or static hosting).
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadSitesCatalog, renderPortalHTML } from './portal-template.mjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.resolve(process.argv[2] || path.join(repoRoot, 'dist'));

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'sites'), { recursive: true });

const sites = loadSitesCatalog(repoRoot, { includeTemplate: false });
for (const site of sites) {
  const src = path.join(repoRoot, 'sites', site.slug);
  const dst = path.join(outDir, 'sites', site.slug);
  fs.cpSync(src, dst, { recursive: true });
}

const html = renderPortalHTML(sites, { baseHref: '.' });
fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf-8');
console.log(`Built Showcase Portal with ${sites.length} site(s) at ${outDir}/index.html`);
