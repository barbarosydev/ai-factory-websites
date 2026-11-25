---
paths:
  - "tests/**"
  - "playwright.config.mjs"
---

# Playwright test conventions

- `tests/site.spec.mjs` is parameterized by `SITE_SLUG` and reads `sites/<slug>/spec.json` directly.
- Never hardcode business names or site-specific copy inside `tests/site.spec.mjs`.
- Always block external network requests (`127.0.0.1` / `localhost` only) so offline/security sanity is enforced deterministically.
- Keep `task test` read-only on `sites/<slug>/evidence/*.png` by default; create or overwrite evidence only when `WRITE_EVIDENCE=1` is set.
- Verify `spec.navigation`, `spec.footer_text`, child-element horizontal bounding-box overflow, and WCAG 2.1 AA accessibility & color contrast (`@axe-core/playwright`); run `STRICT_COPY=1` to reject leaked `section.purpose` prompt text or stub cards.
