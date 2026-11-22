import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const slug = process.env.SITE_SLUG || '_template';
const worktreeRoot = process.env.SITE_WORKTREE_ROOT || process.cwd();
const siteDir = path.join(worktreeRoot, 'sites', slug);
const specPath = path.join(siteDir, 'spec.json');
const trackedEvidenceDir = path.join(siteDir, 'evidence');
const hasCommittedEvidence =
  fs.existsSync(path.join(trackedEvidenceDir, 'desktop.png')) &&
  fs.existsSync(path.join(trackedEvidenceDir, 'mobile.png'));
const writeTrackedEvidence = process.env.WRITE_EVIDENCE === '1' || !hasCommittedEvidence;
const evidenceDir = writeTrackedEvidence
  ? trackedEvidenceDir
  : path.join(process.cwd(), 'test-results', 'evidence', slug);

if (!fs.existsSync(specPath)) {
  throw new Error(`Missing spec.json for site '${slug}' at ${specPath}`);
}

const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));

function attachOfflineAndErrorGuards(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
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

  return {
    consoleErrors,
    pageErrors,
    failedRequests,
    externalRequests,
    async installNetworkGate() {
      await page.route('**/*', (route) => {
        const url = new URL(route.request().url());
        const isLocal = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.protocol === 'data:' || url.protocol === 'blob:';
        if (!isLocal) {
          externalRequests.push(route.request().url());
          route.abort('blockedbyclient');
          return;
        }
        route.continue();
      });
    },
  };
}

test.describe(`Site verification: ${slug}`, () => {
  test('passes all 8 deterministic gates on desktop and mobile', async ({ page }) => {
    fs.mkdirSync(evidenceDir, { recursive: true });
    const guards = attachOfflineAndErrorGuards(page);
    await guards.installNetworkGate();

    // 1. HTTP & Document Load (Desktop 1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    const response = await page.goto(`/sites/${slug}/index.html`, { waitUntil: 'networkidle' });
    expect(response, 'index.html HTTP response').not.toBeNull();
    expect(response.status(), 'index.html HTTP status').toBe(200);

    const docChecks = await page.evaluate(() => {
      const hasDoctype = document.doctype !== null && document.doctype.name.toLowerCase() === 'html';
      const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      const hasMain = document.querySelector('main') !== null;
      const hasHeader = document.querySelector('header, nav') !== null;
      const hasFooter = document.querySelector('footer') !== null;
      return {
        title: document.title.trim(),
        hasDoctype,
        hasViewport: viewport.includes('width=device-width'),
        hasMain,
        hasHeader,
        hasFooter,
      };
    });

    expect(docChecks.hasDoctype, '<!DOCTYPE html> required').toBe(true);
    expect(docChecks.hasViewport, '<meta name="viewport" content="width=device-width..."> required').toBe(true);
    expect(docChecks.title.length, '<title> must be non-empty').toBeGreaterThan(0);
    expect(docChecks.hasHeader, '<header> or <nav> landmark required').toBe(true);
    expect(docChecks.hasMain, '<main> landmark required').toBe(true);
    expect(docChecks.hasFooter, '<footer> landmark required').toBe(true);

    // 3b. Spec Navigation & Footer Fidelity
    for (const navItem of spec.navigation || []) {
      const navLink = page.locator(`header a[href="${navItem.href}"], nav a[href="${navItem.href}"]`).first();
      await expect(navLink, `Navigation link ${navItem.label} (${navItem.href}) must exist in header/nav`).toBeVisible();
    }
    if (spec.footer_text) {
      const footerText = (await page.locator('footer').innerText()).replace(/\s+/g, ' ').trim().toLowerCase();
      const expectedFooter = spec.footer_text.replace(/\s+/g, ' ').trim().toLowerCase();
      expect(footerText, `<footer> must include spec.footer_text`).toContain(expectedFooter);
    }

    // 4 & 5. Required Sections, Headings & Keywords
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

      if (process.env.STRICT_COPY === '1' && section.purpose && section.purpose.trim().length >= 25) {
        const normalizedPurpose = section.purpose.replace(/\s+/g, ' ').trim().toLowerCase();
        const paragraphs = await locator.locator('p').allInnerTexts();
        for (const p of paragraphs) {
          expect(
            p.replace(/\s+/g, ' ').trim().toLowerCase(),
            `Section #${section.id} leaked spec.purpose instruction verbatim into <p>`,
          ).not.toBe(normalizedPurpose);
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

    // 6. Internal Anchor & Relative Link Integrity
    const anchors = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]')).map((a) => ({
        href: a.getAttribute('href') || '',
        text: (a.textContent || '').trim(),
      }));
    });
    for (const a of anchors) {
      if (a.href.startsWith('#') && a.href.length > 1) {
        const targetId = a.href.slice(1);
        const exists = await page.evaluate((id) => document.getElementById(id) !== null, targetId);
        expect(exists, `Broken anchor link '${a.href}' (${a.text}): no element with id='${targetId}'`).toBe(true);
      } else if (a.href && !a.href.startsWith('#') && !a.href.startsWith('mailto:') && !a.href.startsWith('tel:') && !a.href.startsWith('http')) {
        const resp = await page.request.get(`/sites/${slug}/${a.href.replace(/^\.\//, '')}`);
        expect(resp.status(), `Broken relative link '${a.href}'`).toBe(200);
      }
    }

    // 7a. Desktop Layout & Overflow Check + Screenshot (Gate 8a)
    const desktopMetrics = await page.evaluate(() => {
      const vw = window.innerWidth;
      const overflowing = Array.from(document.querySelectorAll('main *'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.right > vw + 1;
        })
        .map((el) => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: vw,
        mainHeight: document.querySelector('main')?.getBoundingClientRect().height || 0,
        overflowing,
      };
    });
    expect(
      desktopMetrics.scrollWidth,
      `Desktop horizontal overflow: scrollWidth=${desktopMetrics.scrollWidth} > innerWidth=${desktopMetrics.innerWidth}`,
    ).toBeLessThanOrEqual(desktopMetrics.innerWidth);
    expect(
      desktopMetrics.overflowing,
      `Desktop child elements extend past viewport: ${desktopMetrics.overflowing.join(', ')}`,
    ).toEqual([]);
    expect(desktopMetrics.mainHeight, '<main> height must be > 300px').toBeGreaterThan(300);

    const desktopPng = path.join(evidenceDir, 'desktop.png');
    await page.screenshot({ path: desktopPng, fullPage: true });
    expect(fs.statSync(desktopPng).size, 'desktop.png must be non-empty').toBeGreaterThan(5000);
    expect(
      fs.statSync(path.join(trackedEvidenceDir, 'desktop.png')).size,
      'committed sites/<slug>/evidence/desktop.png must be non-empty',
    ).toBeGreaterThan(5000);

    // 7b. Mobile Viewport (375x812) Layout & Overflow Check + Screenshot (Gate 8b)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(100);
    const mobileMetrics = await page.evaluate(() => {
      const vw = window.innerWidth;
      const overflowing = Array.from(document.querySelectorAll('main *'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.right > vw + 1;
        })
        .map((el) => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: vw,
        overflowing,
      };
    });
    expect(
      mobileMetrics.scrollWidth,
      `Mobile horizontal overflow: scrollWidth=${mobileMetrics.scrollWidth} > innerWidth=${mobileMetrics.innerWidth}`,
    ).toBeLessThanOrEqual(mobileMetrics.innerWidth);
    expect(
      mobileMetrics.overflowing,
      `Mobile child elements extend past viewport: ${mobileMetrics.overflowing.join(', ')}`,
    ).toEqual([]);

    const mobilePng = path.join(evidenceDir, 'mobile.png');
    await page.screenshot({ path: mobilePng, fullPage: true });
    expect(fs.statSync(mobilePng).size, 'mobile.png must be non-empty').toBeGreaterThan(5000);
    expect(
      fs.statSync(path.join(trackedEvidenceDir, 'mobile.png')).size,
      'committed sites/<slug>/evidence/mobile.png must be non-empty',
    ).toBeGreaterThan(5000);

    // 2 & 3. Zero Console/Page Errors, Zero Failed Assets, Zero Outbound External Requests
    expect(guards.externalRequests, `External outbound requests blocked: ${guards.externalRequests.join(', ')}`).toEqual([]);
    expect(guards.failedRequests, `Failed local asset requests: ${guards.failedRequests.join(', ')}`).toEqual([]);
    expect(guards.consoleErrors, `Browser console errors: ${guards.consoleErrors.join('; ')}`).toEqual([]);
    expect(guards.pageErrors, `Uncaught page errors: ${guards.pageErrors.join('; ')}`).toEqual([]);
  });
});
