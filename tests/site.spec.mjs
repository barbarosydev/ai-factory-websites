import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const worktreeRoot = process.env.SITE_WORKTREE_ROOT || process.cwd();
const writeTrackedEvidence = process.env.WRITE_EVIDENCE === '1';
const strictCopyEnabled = process.env.STRICT_COPY !== '0';

const HTML_TAG_ELEMENTS = new Set([
  'h1', 'h2', 'h3', 'h4', 'p', 'a', 'ul', 'ol', 'dl', 'table', 'form',
  'nav', 'address', 'article', 'aside', 'figure', 'svg', 'button', 'blockquote',
]);

const PLACEHOLDER_PATTERNS = [
  /map location placeholder/i,
  /lorem ipsum/i,
  /dolor sit amet/i,
  /placeholder (?:text|image|map|content)/i,
  /\b(?:TODO|TBD|FIXME)\b/,
];

const LEAKED_CSS_COMMENT_RE = /existing\s+styles\.css\s+content\s+is\s+preserved/i;

function resolveSlugs() {
  if (process.env.ALL_SITES === '1' && !process.env.SITE_SLUG) {
    const sitesRoot = path.join(worktreeRoot, 'sites');
    return fs
      .readdirSync(sitesRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort();
  }
  return [process.env.SITE_SLUG || '_template'];
}

function resolveEvidenceDir(slug, trackedEvidenceDir) {
  if (writeTrackedEvidence) {
    return trackedEvidenceDir;
  }
  const preferred = path.join(process.cwd(), 'test-results', 'evidence', slug);
  try {
    fs.mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), 'ai-factory-evidence', slug);
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function attachOfflineAndErrorGuards(page, expectedOrigin) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badStatusResponses = [];
  const externalRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err));
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.url()} (${req.failure()?.errorText || 'failed'})`);
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      badStatusResponses.push(`${resp.status()} ${resp.url()}`);
    }
  });

  return {
    consoleErrors,
    pageErrors,
    failedRequests,
    badStatusResponses,
    externalRequests,
    async installNetworkGate() {
      await page.route('**/*', (route) => {
        const url = new URL(route.request().url());
        const allowed =
          url.origin === expectedOrigin ||
          url.protocol === 'data:' ||
          url.protocol === 'blob:';
        if (!allowed) {
          externalRequests.push(route.request().url());
          route.abort('blockedbyclient');
          return;
        }
        route.continue();
      });
    },
  };
}

function summarizeAxeIssues(axeResults, viewportLabel) {
  const issues = [];
  for (const v of axeResults.violations) {
    const firstTarget = v.nodes[0]?.target?.join(' ') || 'document';
    const detail = v.nodes[0]?.failureSummary?.replace(/\s+/g, ' ').trim() || v.help;
    issues.push(
      `[${viewportLabel}][${v.impact || 'unknown'}] ${v.id} (${v.nodes.length} node(s), e.g. ${firstTarget}): ${detail}`,
    );
  }
  // Catch 1:1 invisible text (equalRatio) and deterministic low-contrast entries that axe puts in `incomplete`.
  for (const inc of axeResults.incomplete || []) {
    if (inc.id !== 'color-contrast') continue;
    for (const node of inc.nodes || []) {
      const checks = [...(node.any || []), ...(node.all || []), ...(node.none || [])];
      for (const chk of checks) {
        const data = chk.data || {};
        const hasMeasuredColors = Boolean(data.fgColor && data.bgColor && typeof data.contrastRatio === 'number' && data.contrastRatio > 0);
        const isInvisible =
          data.messageKey === 'equalRatio' ||
          (hasMeasuredColors &&
            typeof data.expectedContrastRatio === 'string' &&
            data.contrastRatio < Number.parseFloat(data.expectedContrastRatio));
        if (isInvisible) {
          const target = node.target?.join(' ') || 'element';
          issues.push(
            `[${viewportLabel}][critical] color-contrast (${target}): fg=${data.fgColor || '?'} on bg=${data.bgColor || '?'} ratio=${data.contrastRatio ?? '1.0'} (messageKey=${data.messageKey || 'low-contrast'})`,
          );
        }
      }
    }
  }
  return issues;
}

async function checkViewportOverflow(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const overflowing = Array.from(document.querySelectorAll('header *, main *, footer *'))
      .filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > vw + 1);
      })
      .map((el) => {
        const cls = (el.getAttribute('class') || '').trim().split(/\s+/)[0];
        return el.tagName.toLowerCase() + (cls ? `.${cls}` : '');
      });
    const header = document.querySelector('header');
    const stickyHeader = header ? window.getComputedStyle(header).position === 'sticky' : false;
    const htmlOverflowX = window.getComputedStyle(document.documentElement).overflowX;
    const bodyOverflowX = window.getComputedStyle(document.body).overflowX;
    const stickyBrokenByOverflow =
      stickyHeader && (htmlOverflowX === 'hidden' || bodyOverflowX === 'hidden');
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: vw,
      mainHeight: document.querySelector('main')?.getBoundingClientRect().height || 0,
      overflowing,
      stickyBrokenByOverflow,
    };
  });
}

for (const slug of resolveSlugs()) {
  const siteDir = path.join(worktreeRoot, 'sites', slug);
  const specPath = path.join(siteDir, 'spec.json');
  const trackedEvidenceDir = path.join(siteDir, 'evidence');

  if (!fs.existsSync(specPath)) {
    throw new Error(`Missing spec.json for site '${slug}' at ${specPath}`);
  }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));

  test.describe(`Site verification: ${slug}`, () => {
    test('gate-01: HTTP 200, HTML5 landmarks, and linked stylesheet', async ({ page, baseURL }) => {
      const guards = attachOfflineAndErrorGuards(page, new URL(baseURL).origin);
      await guards.installNetworkGate();
      await page.setViewportSize({ width: 1280, height: 800 });

      const response = await page.goto(`/sites/${slug}/index.html`, { waitUntil: 'networkidle' });
      expect(response, 'index.html HTTP response').not.toBeNull();
      expect(response.status(), 'index.html HTTP status').toBe(200);

      const docChecks = await page.evaluate(() => {
        const hasDoctype = document.doctype !== null && document.doctype.name.toLowerCase() === 'html';
        const hasCharset =
          document.querySelector('meta[charset]')?.getAttribute('charset')?.toLowerCase() === 'utf-8';
        const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
        const hasLinkedCss = document.querySelector('link[rel="stylesheet"]') !== null;
        let ruleCount = 0;
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            ruleCount += sheet.cssRules?.length || 0;
          } catch {
            // cross-origin blocked separately
          }
        }
        return {
          title: document.title.trim(),
          hasDoctype,
          hasCharset,
          hasViewport: viewport.includes('width=device-width'),
          hasMain: document.querySelector('main') !== null,
          hasHeader: document.querySelector('header, nav') !== null,
          hasFooter: document.querySelector('footer') !== null,
          hasLinkedCss,
          sheetCount: document.styleSheets.length,
          ruleCount,
        };
      });

      expect(docChecks.hasDoctype, '<!DOCTYPE html> required').toBe(true);
      expect(docChecks.hasCharset, '<meta charset="UTF-8"> required').toBe(true);
      expect(docChecks.hasViewport, '<meta name="viewport" content="width=device-width..."> required').toBe(true);
      expect(docChecks.title.length, '<title> must be non-empty').toBeGreaterThan(0);
      expect(docChecks.hasHeader, '<header> or <nav> landmark required').toBe(true);
      expect(docChecks.hasMain, '<main> landmark required').toBe(true);
      expect(docChecks.hasFooter, '<footer> landmark required').toBe(true);
      expect(docChecks.hasLinkedCss, '<link rel="stylesheet"> is required').toBe(true);
      expect(docChecks.sheetCount, 'Linked stylesheet must load').toBeGreaterThan(0);
      expect(docChecks.ruleCount, 'Stylesheet must contain at least 3 CSS rules').toBeGreaterThanOrEqual(3);
    });

    test('gate-02 & gate-03: zero console/page/HTTP errors and zero external network requests', async ({ page, baseURL }) => {
      const guards = attachOfflineAndErrorGuards(page, new URL(baseURL).origin);
      await guards.installNetworkGate();
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/sites/${slug}/index.html`, { waitUntil: 'networkidle' });

      const brokenImages = await page.evaluate(() =>
        Array.from(document.querySelectorAll('img'))
          .filter((img) => !img.complete || img.naturalWidth === 0)
          .map((img) => img.getAttribute('src') || '(inline)'),
      );

      expect(guards.externalRequests, `External outbound requests blocked: ${guards.externalRequests.join(', ')}`).toEqual([]);
      expect(guards.failedRequests, `Failed local asset requests: ${guards.failedRequests.join(', ')}`).toEqual([]);
      expect(guards.badStatusResponses, `HTTP 4xx/5xx responses: ${guards.badStatusResponses.join(', ')}`).toEqual([]);
      expect(brokenImages, `Broken <img> elements: ${brokenImages.join(', ')}`).toEqual([]);
      expect(guards.consoleErrors, `Browser console errors: ${guards.consoleErrors.join('; ')}`).toEqual([]);
      expect(guards.pageErrors, `Uncaught page errors: ${guards.pageErrors.join('; ')}`).toEqual([]);
    });

    test('gate-04: navigation links and footer match spec.json', async ({ page, baseURL }) => {
      expect(Array.isArray(spec.navigation) && spec.navigation.length > 0, 'spec.navigation must be non-empty').toBe(true);
      expect(typeof spec.footer_text === 'string' && spec.footer_text.trim().length > 0, 'spec.footer_text must be non-empty').toBe(true);

      const guards = attachOfflineAndErrorGuards(page, new URL(baseURL).origin);
      await guards.installNetworkGate();
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/sites/${slug}/index.html`, { waitUntil: 'networkidle' });

      const renderedNav = await page.evaluate(() =>
        Array.from(document.querySelectorAll('header a[href], nav a[href]')).map((a) => ({
          href: (a.getAttribute('href') || '').trim(),
          text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
          visible: a.getBoundingClientRect().width > 0 && a.getBoundingClientRect().height > 0,
        })),
      );

      for (const navItem of spec.navigation) {
        const matchesHref = renderedNav.filter((a) => a.href === navItem.href && a.visible);
        expect(matchesHref.length, `Navigation link '${navItem.label}' (${navItem.href}) must exist and be visible in header/nav`).toBeGreaterThan(0);
        const wantLabel = (navItem.label || '').trim().toLowerCase();
        if (wantLabel) {
          const labelMatch = matchesHref.some((a) => a.text.toLowerCase().includes(wantLabel));
          expect(
            labelMatch,
            `Navigation link for ${navItem.href} should display label '${navItem.label}' (found: ${matchesHref.map((m) => m.text).join(', ')})`,
          ).toBe(true);
        }
      }

      const footerText = (await page.locator('footer').innerText()).replace(/\s+/g, ' ').trim().toLowerCase();
      const expectedFooter = spec.footer_text.replace(/\s+/g, ' ').trim().toLowerCase();
      expect(footerText, '<footer> must include spec.footer_text').toContain(expectedFooter);
    });

    test('gate-05: required sections, headings, keywords, and semantic elements', async ({ page, baseURL }) => {
      const guards = attachOfflineAndErrorGuards(page, new URL(baseURL).origin);
      await guards.installNetworkGate();
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/sites/${slug}/index.html`, { waitUntil: 'networkidle' });

      for (const section of spec.sections || []) {
        const locator = page.locator(`#${section.id}`);
        await expect(locator, `Section #${section.id} must exist and be visible`).toBeVisible();
        const heading = locator.locator('h1, h2, h3').first();
        await expect(heading, `Section #${section.id} must have a visible heading`).toBeVisible();

        const sectionText = (await locator.innerText()).toLowerCase();
        for (const kw of section.required_keywords || []) {
          expect(
            sectionText.includes(kw.toLowerCase()),
            `Section #${section.id} missing required keyword '${kw}'`,
          ).toBe(true);
        }

        for (const elTag of section.required_elements || []) {
          const tag = String(elTag).trim().toLowerCase();
          if (HTML_TAG_ELEMENTS.has(tag)) {
            const count = await locator.locator(tag).count();
            expect(count, `Section #${section.id} missing required HTML element <${tag}>`).toBeGreaterThan(0);
          }
        }
      }
    });

    test('gate-06: internal anchors and relative links are valid (no dead # or javascript: links)', async ({ page, baseURL }) => {
      const guards = attachOfflineAndErrorGuards(page, new URL(baseURL).origin);
      await guards.installNetworkGate();
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/sites/${slug}/index.html`, { waitUntil: 'networkidle' });

      const anchors = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]')).map((a) => ({
          href: (a.getAttribute('href') || '').trim(),
          text: (a.textContent || '').trim(),
        })),
      );

      for (const a of anchors) {
        expect(a.href.length, `Empty href="" on link '${a.text}'`).toBeGreaterThan(0);
        expect(a.href, `Dead placeholder href="#" on link '${a.text}'`).not.toBe('#');
        expect(a.href.toLowerCase().startsWith('javascript:'), `Unsafe javascript: href on '${a.text}'`).toBe(false);

        if (a.href.startsWith('#')) {
          const targetId = a.href.slice(1);
          const exists = await page.evaluate((id) => document.getElementById(id) !== null, targetId);
          expect(exists, `Broken anchor link '${a.href}' (${a.text}): no element with id='${targetId}'`).toBe(true);
        } else if (!a.href.startsWith('mailto:') && !a.href.startsWith('tel:') && !a.href.startsWith('http')) {
          const cleanHref = a.href.split('#')[0].split('?')[0].replace(/^\.\//, '');
          const resp = await page.request.get(`/sites/${slug}/${cleanHref}`);
          expect(resp.status(), `Broken relative link '${a.href}'`).toBe(200);
        }
      }
    });

    test('gate-07: responsive layout, zero header/main/footer overflow, and sticky header sanity', async ({ page, baseURL }) => {
      const guards = attachOfflineAndErrorGuards(page, new URL(baseURL).origin);
      await guards.installNetworkGate();

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/sites/${slug}/index.html`, { waitUntil: 'networkidle' });
      const desktop = await checkViewportOverflow(page);
      expect(desktop.scrollWidth, `Desktop overflow: ${desktop.scrollWidth} > ${desktop.innerWidth}`).toBeLessThanOrEqual(desktop.innerWidth);
      expect(desktop.overflowing, `Desktop overflowing elements: ${desktop.overflowing.join(', ')}`).toEqual([]);
      expect(desktop.mainHeight, '<main> height must be > 300px').toBeGreaterThan(300);
      expect(desktop.stickyBrokenByOverflow, 'overflow-x: hidden on html/body breaks position: sticky header').toBe(false);

      await page.setViewportSize({ width: 375, height: 812 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const mobile = await checkViewportOverflow(page);
      expect(mobile.scrollWidth, `Mobile overflow: ${mobile.scrollWidth} > ${mobile.innerWidth}`).toBeLessThanOrEqual(mobile.innerWidth);
      expect(mobile.overflowing, `Mobile overflowing elements: ${mobile.overflowing.join(', ')}`).toEqual([]);
    });

    test('gate-08: visual evidence screenshots on desktop and mobile', async ({ page, baseURL }) => {
      const evidenceDir = resolveEvidenceDir(slug, trackedEvidenceDir);
      const guards = attachOfflineAndErrorGuards(page, new URL(baseURL).origin);
      await guards.installNetworkGate();

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/sites/${slug}/index.html`, { waitUntil: 'networkidle' });
      const desktopPng = path.join(evidenceDir, 'desktop.png');
      await page.screenshot({ path: desktopPng, fullPage: true });
      expect(fs.statSync(desktopPng).size, 'desktop.png must be non-empty').toBeGreaterThan(5000);

      await page.setViewportSize({ width: 375, height: 812 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const mobilePng = path.join(evidenceDir, 'mobile.png');
      await page.screenshot({ path: mobilePng, fullPage: true });
      expect(fs.statSync(mobilePng).size, 'mobile.png must be non-empty').toBeGreaterThan(5000);

      for (const name of ['desktop.png', 'mobile.png']) {
        const trackedFile = path.join(trackedEvidenceDir, name);
        expect(fs.existsSync(trackedFile), `Missing committed evidence file sites/${slug}/evidence/${name}`).toBe(true);
        expect(fs.statSync(trackedFile).size, `Committed sites/${slug}/evidence/${name} must be > 5000 bytes`).toBeGreaterThan(5000);
      }
    });

    test('gate-09: WCAG 2.1 AA accessibility and contrast (desktop and mobile, including invisible text)', async ({ page, baseURL }) => {
      const guards = attachOfflineAndErrorGuards(page, new URL(baseURL).origin);
      await guards.installNetworkGate();

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/sites/${slug}/index.html`, { waitUntil: 'networkidle' });
      const desktopAxe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const desktopIssues = summarizeAxeIssues(desktopAxe, 'desktop');

      await page.setViewportSize({ width: 375, height: 812 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const mobileAxe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const mobileIssues = summarizeAxeIssues(mobileAxe, 'mobile');

      const allIssues = [...desktopIssues, ...mobileIssues];
      expect(allIssues, `WCAG / contrast violations:\n${allIssues.join('\n')}`).toEqual([]);
    });

    test('gate-10: semantic HTML hierarchy, focus styles, and interactive mobile navigation', async ({ page, baseURL }) => {
      const guards = attachOfflineAndErrorGuards(page, new URL(baseURL).origin);
      await guards.installNetworkGate();
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/sites/${slug}/index.html`, { waitUntil: 'networkidle' });

      const semantics = await page.evaluate(() => {
        const h1Count = document.querySelectorAll('h1').length;
        const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id);
        const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) =>
          Number(h.tagName.slice(1)),
        );
        const skippedHeadingLevels = [];
        for (let i = 1; i < headings.length; i += 1) {
          if (headings[i] - headings[i - 1] > 1) {
            skippedHeadingLevels.push(`h${headings[i - 1]} -> h${headings[i]}`);
          }
        }
        const buttonsWithoutType = Array.from(document.querySelectorAll('button'))
          .filter((b) => !b.getAttribute('type'))
          .map((b) => (b.textContent || '').trim() || b.className || 'button');

        let hasFocusVisibleRule = false;
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules || [])) {
              if (rule.cssText && rule.cssText.includes(':focus-visible')) {
                hasFocusVisibleRule = true;
              }
            }
          } catch {
            // ignore
          }
        }
        return { h1Count, dupIds, skippedHeadingLevels, buttonsWithoutType, hasFocusVisibleRule };
      });

      expect(semantics.h1Count, 'Page must have exactly one <h1>').toBe(1);
      expect(semantics.dupIds, `Duplicate element IDs found: ${semantics.dupIds.join(', ')}`).toEqual([]);
      expect(semantics.skippedHeadingLevels, `Skipped heading levels: ${semantics.skippedHeadingLevels.join(', ')}`).toEqual([]);
      expect(semantics.buttonsWithoutType, `Buttons missing explicit type attribute: ${semantics.buttonsWithoutType.join(', ')}`).toEqual([]);
      expect(semantics.hasFocusVisibleRule, 'Stylesheet must include :focus-visible keyboard focus styles').toBe(true);

      // Verify interactive mobile nav toggle if present
      await page.setViewportSize({ width: 375, height: 812 });
      const toggle = page.locator('header button[aria-controls], .nav-toggle, .menu-toggle').first();
      if ((await toggle.count()) > 0 && (await toggle.isVisible())) {
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const navFirstLink = page.locator('header nav a, nav a').first();
        await expect(navFirstLink, 'Mobile nav links must be visible when menu is toggled open').toBeVisible();
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      }
    });

    test('gate-11: copy authenticity, anti-prompt-leak, and zero placeholder stubs', async ({ page, baseURL }) => {
      const guards = attachOfflineAndErrorGuards(page, new URL(baseURL).origin);
      await guards.installNetworkGate();
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/sites/${slug}/index.html`, { waitUntil: 'networkidle' });

      const bodyText = await page.locator('body').innerText();
      for (const pat of PLACEHOLDER_PATTERNS) {
        expect(pat.test(bodyText), `Placeholder copy matched ${pat} in rendered page`).toBe(false);
      }

      const cssPath = path.join(siteDir, 'styles.css');
      if (fs.existsSync(cssPath)) {
        const cssText = fs.readFileSync(cssPath, 'utf-8');
        expect(LEAKED_CSS_COMMENT_RE.test(cssText), 'Leaked LLM placeholder comment found in styles.css').toBe(false);
      }

      if (strictCopyEnabled) {
        for (const section of spec.sections || []) {
          const locator = page.locator(`#${section.id}`);
          if (section.purpose?.trim()) {
            const normalizedPurpose = section.purpose.replace(/\s+/g, ' ').trim().toLowerCase();
            const paragraphs = await locator.locator('p').allInnerTexts();
            for (const p of paragraphs) {
              expect(
                p.replace(/\s+/g, ' ').trim().toLowerCase(),
                `Section #${section.id} leaked spec.purpose instruction verbatim into <p>`,
              ).not.toBe(normalizedPurpose);
            }
          }
          const cards = await locator.locator('.card p').allInnerTexts();
          for (const kw of section.required_keywords || []) {
            const stubPattern = `${section.heading} — ${kw}`.toLowerCase();
            for (const c of cards) {
              expect(c.trim().toLowerCase(), `Section #${section.id} contains stub card copy`).not.toBe(stubPattern);
            }
          }
        }
      }
    });
  });
}
