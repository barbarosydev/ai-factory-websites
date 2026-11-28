/**
 * Shared zero-dependency HTML renderer for the AI Software Factory Showcase Portal
 * and interactive Desktop / Tablet / Mobile preview studio.
 */
import fs from 'node:fs';
import path from 'node:path';

export function loadSitesCatalog(rootDir, { includeTemplate = false } = {}) {
  const sitesDir = path.join(rootDir, 'sites');
  if (!fs.existsSync(sitesDir)) {
    return [];
  }
  const entries = fs
    .readdirSync(sitesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .filter((d) => includeTemplate || !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();

  const sites = [];
  for (const slug of entries) {
    const specPath = path.join(sitesDir, slug, 'spec.json');
    if (!fs.existsSync(specPath)) continue;
    try {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      const hasDesktop = fs.existsSync(path.join(sitesDir, slug, 'evidence', 'desktop.png'));
      const hasMobile = fs.existsSync(path.join(sitesDir, slug, 'evidence', 'mobile.png'));
      sites.push({
        slug,
        title: spec.page_title || slug,
        tagline: spec.tagline || '',
        category: spec.category || 'Static Site',
        operation: spec.operation || 'create',
        theme: spec.theme || {},
        sectionsCount: Array.isArray(spec.sections) ? spec.sections.length : 0,
        navCount: Array.isArray(spec.navigation) ? spec.navigation.length : 0,
        footerText: spec.footer_text || '',
        hasDesktop,
        hasMobile,
        spec,
      });
    } catch {
      // Skip malformed specs during preview rendering
    }
  }
  return sites;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonForScript(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function renderPortalHTML(sites, { baseHref = '' } = {}) {
  const prefix = baseHref ? baseHref.replace(/\/+$/, '') + '/' : '';
  const categories = Array.from(new Set(sites.map((s) => s.category))).sort();

  const cardsHtml = sites
    .map((site) => {
      const siteUrl = `${prefix}sites/${encodeURIComponent(site.slug)}/index.html`;
      const thumbUrl = `${prefix}sites/${encodeURIComponent(site.slug)}/evidence/desktop.png`;
      const colors = [
        site.theme.primary_color,
        site.theme.background_color,
        site.theme.accent_color,
      ].filter(Boolean);
      const swatches = colors
        .map(
          (hex) =>
            `<span class="swatch" style="background:${escapeHtml(hex)}" title="${escapeHtml(hex)}"></span>`,
        )
        .join('');

      return `<article class="site-card" data-category="${escapeHtml(site.category)}" data-search="${escapeHtml(
        `${site.slug} ${site.title} ${site.tagline} ${site.category}`.toLowerCase(),
      )}">
        <div class="card-media">
          ${
            site.hasDesktop
              ? `<img src="${thumbUrl}" alt="${escapeHtml(site.title)} desktop preview" loading="lazy">`
              : `<div class="media-fallback">${escapeHtml(site.slug)}</div>`
          }
          <span class="badge-cat">${escapeHtml(site.category)}</span>
        </div>
        <div class="card-body">
          <div class="card-top">
            <h2>${escapeHtml(site.title.split('—')[0].trim())}</h2>
            <div class="swatches" aria-label="Theme palette">${swatches}</div>
          </div>
          <p class="card-tagline">${escapeHtml(site.tagline)}</p>
          <div class="card-meta">
            <span><code>${escapeHtml(site.slug)}</code></span>
            <span>${site.sectionsCount} sections · WCAG 2.1 AA</span>
          </div>
          <div class="card-actions">
            <button type="button" class="btn-studio" data-open-studio="${escapeHtml(site.slug)}">Live Studio</button>
            <a class="btn-open" href="${siteUrl}" target="_blank" rel="noopener">Open Site</a>
          </div>
        </div>
      </article>`;
    })
    .join('\n');

  const filterButtons = [
    `<button type="button" class="chip is-active" data-filter="all">All (${sites.length})</button>`,
    ...categories.map((cat) => {
      const count = sites.filter((s) => s.category === cat).length;
      return `<button type="button" class="chip" data-filter="${escapeHtml(cat)}">${escapeHtml(cat)} (${count})</button>`;
    }),
  ].join('\n');

  const payload = sites.map((s) => ({
    slug: s.slug,
    title: s.title,
    category: s.category,
    url: `${prefix}sites/${encodeURIComponent(s.slug)}/index.html`,
    spec: s.spec,
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Software Factory — Verified Sites Showcase</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230F172A'/%3E%3Ccircle cx='16' cy='16' r='8' fill='%2310B981'/%3E%3C/svg%3E">
  <style>
    :root {
      --bg: #0b1120;
      --surface: #111827;
      --surface-2: #1e293b;
      --border: #273549;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #10b981;
      --accent-hover: #059669;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .wrap { width: min(1240px, 100% - 2rem); margin-inline: auto; }
    header.hero-bar {
      padding: 2.5rem 0 1.75rem;
      border-bottom: 1px solid var(--border);
      background: radial-gradient(circle at top right, rgba(16, 185, 129, 0.14), transparent 48%), var(--bg);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      font-weight: 700;
      margin: 0 0 0.5rem;
    }
    h1 { margin: 0 0 0.5rem; font-size: clamp(1.75rem, 3vw, 2.5rem); line-height: 1.15; }
    .subtitle { margin: 0; color: var(--muted); max-width: 68ch; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin: 1.5rem 0;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .chip {
      background: var(--surface);
      color: var(--muted);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.4rem 0.9rem;
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .chip.is-active, .chip:hover { color: var(--text); border-color: var(--accent); }
    .chip.is-active { background: rgba(16, 185, 129, 0.15); }
    .search-input {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 0.5rem 0.85rem;
      min-width: 240px;
      font: inherit;
      font-size: 0.9rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 1.5rem;
      padding-bottom: 3rem;
    }
    .site-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.9rem;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.18s ease, border-color 0.18s ease;
    }
    .site-card:hover { transform: translateY(-2px); border-color: #3b516e; }
    .site-card[hidden] { display: none; }
    .card-media {
      position: relative;
      aspect-ratio: 16 / 10;
      background: var(--surface-2);
      overflow: hidden;
      border-bottom: 1px solid var(--border);
    }
    .card-media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      display: block;
    }
    .media-fallback {
      height: 100%;
      display: grid;
      place-items: center;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .badge-cat {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      background: rgba(15, 23, 42, 0.88);
      color: #e2e8f0;
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 999px;
      padding: 0.2rem 0.65rem;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .card-body { padding: 1.15rem; display: flex; flex-direction: column; gap: 0.7rem; flex: 1; }
    .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
    .card-top h2 { margin: 0; font-size: 1.1rem; line-height: 1.25; }
    .swatches { display: flex; gap: 0.3rem; padding-top: 0.2rem; flex-shrink: 0; }
    .swatch {
      width: 0.85rem;
      height: 0.85rem;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.3);
      display: inline-block;
    }
    .card-tagline { margin: 0; color: var(--muted); font-size: 0.9rem; flex: 1; }
    .card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      color: var(--muted);
      border-top: 1px solid var(--border);
      padding-top: 0.65rem;
    }
    .card-meta code { color: #cbd5e1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .card-actions { display: flex; gap: 0.6rem; }
    .btn-studio, .btn-open {
      flex: 1;
      text-align: center;
      padding: 0.55rem 0.85rem;
      border-radius: 0.5rem;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
    }
    .btn-studio { background: var(--accent); color: #052e16; border: none; }
    .btn-studio:hover { background: var(--accent-hover); color: #ffffff; }
    .btn-open { background: var(--surface-2); color: var(--text); border: 1px solid var(--border); }
    .btn-open:hover { border-color: var(--accent); }
    button:focus-visible, a:focus-visible, input:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    dialog.studio-modal {
      width: min(1380px, 96vw);
      height: 92vh;
      max-width: none;
      max-height: none;
      margin: auto;
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 0.9rem;
      background: var(--surface);
      color: var(--text);
      overflow: hidden;
    }
    dialog.studio-modal::backdrop { background: rgba(2, 6, 23, 0.78); }
    .studio-shell { display: flex; flex-direction: column; height: 100%; }
    .studio-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
      background: var(--bg);
    }
    .studio-title { font-weight: 700; font-size: 0.95rem; }
    .studio-controls { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .vp-btn {
      background: var(--surface-2);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 0.45rem;
      padding: 0.35rem 0.7rem;
      font: inherit;
      font-size: 0.82rem;
      cursor: pointer;
    }
    .vp-btn.is-active { background: var(--accent); color: #052e16; border-color: var(--accent); font-weight: 700; }
    .studio-stage {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: stretch;
      background: #020617;
      padding: 1rem;
      overflow: auto;
    }
    .studio-frame {
      border: 1px solid var(--border);
      border-radius: 0.6rem;
      background: #ffffff;
      width: 100%;
      height: 100%;
      transition: width 0.2s ease;
    }
    .studio-spec {
      width: 100%;
      max-width: 960px;
      margin: 0 auto;
      padding: 1rem 1.25rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.6rem;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.85rem;
      overflow: auto;
      white-space: pre;
    }
    footer.portal-footer {
      border-top: 1px solid var(--border);
      padding: 1.5rem 0;
      color: var(--muted);
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <header class="hero-bar">
    <div class="wrap">
      <p class="eyebrow">AI Software Factory · Local Apple Silicon Multi-Agent Portfolio</p>
      <h1>Autonomous Static Websites Showcase</h1>
      <p class="subtitle">Every site below is plain semantic HTML5, modern CSS, and vanilla ES6 JS — zero external CDNs, verified across 11 Playwright &amp; WCAG 2.1 AA quality gates.</p>
    </div>
  </header>

  <main class="wrap">
    <div class="toolbar">
      <div class="chips" role="group" aria-label="Filter by category">
        ${filterButtons}
      </div>
      <input class="search-input" type="search" id="site-search" placeholder="Search sites, slugs, categories..." aria-label="Search sites">
    </div>
    <section class="grid" id="sites-grid" aria-label="Generated websites">
      ${cardsHtml}
    </section>
  </main>

  <footer class="portal-footer">
    <div class="wrap">Generated from <code>sites/*/spec.json</code> · Zero external network requests · Verified with Playwright &amp; @axe-core/playwright</div>
  </footer>

  <dialog class="studio-modal" id="studio-modal" aria-label="Responsive Site Preview Studio">
    <div class="studio-shell">
      <div class="studio-bar">
        <span class="studio-title" id="studio-title">Preview</span>
        <div class="studio-controls">
          <button type="button" class="vp-btn is-active" data-vp="1280px">Desktop 1280</button>
          <button type="button" class="vp-btn" data-vp="768px">Tablet 768</button>
          <button type="button" class="vp-btn" data-vp="375px">Mobile 375</button>
          <button type="button" class="vp-btn" data-vp="spec">spec.json</button>
          <a class="vp-btn" id="studio-open-link" href="#sites-grid" target="_blank" rel="noopener">New Tab</a>
          <button type="button" class="vp-btn" id="studio-close">Close</button>
        </div>
      </div>
      <div class="studio-stage">
        <iframe class="studio-frame" id="studio-frame" title="Live website preview"></iframe>
        <pre class="studio-spec" id="studio-spec" hidden></pre>
      </div>
    </div>
  </dialog>

  <script>
    const SITES = ${safeJsonForScript(payload)};
    const siteMap = new Map(SITES.map((s) => [s.slug, s]));
    const cards = Array.from(document.querySelectorAll('.site-card'));
    const chips = Array.from(document.querySelectorAll('.chip'));
    const searchInput = document.getElementById('site-search');
    let activeFilter = 'all';

    function applyFilters() {
      const q = (searchInput?.value || '').trim().toLowerCase();
      for (const card of cards) {
        const catOk = activeFilter === 'all' || card.dataset.category === activeFilter;
        const textOk = !q || (card.dataset.search || '').includes(q);
        card.hidden = !(catOk && textOk);
      }
    }

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        activeFilter = chip.dataset.filter || 'all';
        chips.forEach((c) => c.classList.toggle('is-active', c === chip));
        applyFilters();
      });
    });
    searchInput?.addEventListener('input', applyFilters);

    const modal = document.getElementById('studio-modal');
    const titleEl = document.getElementById('studio-title');
    const frame = document.getElementById('studio-frame');
    const specEl = document.getElementById('studio-spec');
    const openLink = document.getElementById('studio-open-link');
    const vpBtns = Array.from(document.querySelectorAll('.vp-btn[data-vp]'));

    function setViewport(mode) {
      vpBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.vp === mode));
      if (mode === 'spec') {
        frame.hidden = true;
        specEl.hidden = false;
      } else {
        specEl.hidden = true;
        frame.hidden = false;
        frame.style.width = mode === '1280px' ? 'min(1280px, 100%)' : mode;
      }
    }

    vpBtns.forEach((b) => b.addEventListener('click', () => setViewport(b.dataset.vp)));

    document.querySelectorAll('[data-open-studio]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const site = siteMap.get(btn.dataset.openStudio);
        if (!site) return;
        titleEl.textContent = site.title + ' (' + site.slug + ')';
        frame.src = site.url;
        specEl.textContent = JSON.stringify(site.spec, null, 2);
        openLink.href = site.url;
        setViewport('1280px');
        modal.showModal();
      });
    });

    document.getElementById('studio-close')?.addEventListener('click', () => modal.close());
    modal?.addEventListener('close', () => { frame.src = 'about:blank'; });
  </script>
</body>
</html>
`;
}
