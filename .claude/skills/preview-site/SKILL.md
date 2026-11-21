---
name: preview-site
description: Serve a site locally on loopback and run its Playwright verification gates.
---

# Preview and test a site locally

1. Run Playwright checks and generate screenshots: `SITE_SLUG=<slug> task test`.
2. Start a local static preview server on `127.0.0.1`: `SITE_SLUG=<slug> task preview`.
