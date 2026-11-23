---
paths:
  - "sites/**"
---

# Website conventions

- Each site under `sites/<slug>/` uses plain semantic HTML5 (`index.html`), modern CSS (`styles.css`), and optional vanilla ES6 JS (`script.js`).
- Never place a `package.json`, `node_modules/`, or bundler config inside `sites/<slug>/`.
- Never load external URLs (fonts, CDNs, images, analytics scripts). Use system font stacks, inline SVG, and local CSS.
- Write authentic domain copy in `index.html`; never copy `spec.json` `section.purpose` instructions verbatim into visible `<p>` tags or duplicate `required_keywords` as stub cards.
- Keep navigation links and footer copy aligned with `spec.json`; the Playwright harness verifies both against the rendered page.
- Every site keeps an up-to-date `spec.json` and `evidence/desktop.png` + `evidence/mobile.png`.
