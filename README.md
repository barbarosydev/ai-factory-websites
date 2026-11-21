# ai-factory-websites

Static single-page websites generated, verified, and maintained by the local AI Software Factory (`ai-factory`).

## How it works

1. Open an issue using one of the structured forms in `.github/ISSUE_TEMPLATE/` and apply the `factory:ready` label.
2. `ai-factory` processes one eligible issue at a time inside an isolated git worktree (`.worktrees/issue-<N>/`) on branch `factory/issue-<N>`.
3. Every generated site lives under `sites/<site-slug>/` as plain semantic HTML5, modern CSS, and optional vanilla ES6 JavaScript—with zero per-site npm dependencies.
4. Before a pull request is opened, the shared root `@playwright/test` suite (`tests/site.spec.mjs`) verifies the site against `sites/<site-slug>/spec.json` across desktop (`1280x800`) and mobile (`375x812`) viewports and captures screenshots into `sites/<site-slug>/evidence/`.

## Local commands

See [docs/prerequisites.md](docs/prerequisites.md) for the full Mac setup. From a fresh clone:

```bash
brew bundle --no-upgrade
mise install
npm ci
npx playwright install chromium
pre-commit install
```

```bash
# Run the Playwright suite against a site (defaults to _template)
SITE_SLUG=_template task test

# Preview a site locally
SITE_SLUG=_template task preview

# Run all linters, policies, hook tests, Playwright baseline test, and secret scan
task ci
```

## Sites catalog

| Slug | Category | Status | Source |
| --- | --- | --- | --- |
| `_template` | Reference template | Active | Baseline fixture for Playwright verification |

## Architecture decisions

- [0001. Vanilla static stack and shared Playwright harness](docs/adr/0001-vanilla-static-stack-and-shared-playwright-harness.md)
