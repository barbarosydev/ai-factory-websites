## Summary

- Closes `#<issue-number>`
- What changed and why

## Verification

- [ ] `ALL_SITES=1 task ci` (lint, 11 Playwright + WCAG 2.1 AA gates with `STRICT_COPY=1`, gitleaks)
- [ ] `WRITE_EVIDENCE=1 SITE_SLUG=<slug> task test` (fresh `evidence/desktop.png` and `evidence/mobile.png`)
- [ ] Previewed in interactive studio (`task preview`)
