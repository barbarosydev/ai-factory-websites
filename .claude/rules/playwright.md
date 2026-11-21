---
paths:
  - "tests/**"
  - "playwright.config.mjs"
---

# Playwright test conventions

- `tests/site.spec.mjs` is parameterized by `SITE_SLUG` and reads `sites/<slug>/spec.json` directly.
- Never hardcode business names or site-specific copy inside `tests/site.spec.mjs`.
- Always block external network requests (`127.0.0.1` / `localhost` only) so offline/security sanity is enforced deterministically.
