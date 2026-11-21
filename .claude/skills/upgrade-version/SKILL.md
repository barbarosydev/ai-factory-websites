---
name: upgrade-version
description: Bump pinned versions in mise.toml, package.json, or GitHub Actions workflow SHAs.
---

# Upgrade a pinned version

1. Update tool pins in `mise.toml`, run `mise lock --platform macos-arm64,linux-x64,linux-arm64`, and run `mise install`.
2. For `@playwright/test`, update `package.json`, run `npm install --package-lock-only`, and re-test all sites (`ALL_SITES=1 task ci`).
3. For GitHub Actions in `.github/workflows/*.yml`, pin the full 40-hex commit SHA with the tag in a trailing comment.
