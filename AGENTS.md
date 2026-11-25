# ai-factory-websites

Static single-page websites generated, verified, and maintained by the local AI Software Factory (`ai-factory`).

## Architecture

- Monorepo of independent static websites under `sites/<site-slug>/`.
- Every generated website uses plain semantic HTML5, modern CSS, and optional vanilla ES6 JavaScript (`index.html`, `styles.css`, optional `script.js`, `spec.json`, `evidence/desktop.png`, `evidence/mobile.png`).
- Shared root tooling only: `@playwright/test` and `@axe-core/playwright` are pinned once in root `package.json`. Individual sites under `sites/` never contain their own `package.json` or `node_modules/`.
- GitHub Issues (`.github/ISSUE_TEMPLATE/`) and `factory:*` labels are the customer intake and human-in-the-loop interface.
- `ai-factory` works exclusively in isolated git worktrees (`.worktrees/issue-<N>/` on branch `factory/issue-<N>`), never directly on `main`.

## Commands

Use `task` for everything; logic lives in `scripts/`.

| Command | Use |
| --- | --- |
| `task lint` | Shellcheck, ruff, JSON/YAML syntax, Conftest policies, actionlint, and doc/command checks |
| `task test` | Hook tests + Playwright verification suite (`SITE_SLUG=<slug>` or `ALL_SITES=1`) |
| `task ci` | `task lint`, `task test`, and `gitleaks` secret scan (used by pre-commit and GitHub Actions) |
| `task preview` | Serve `sites/<SITE_SLUG>/` locally on loopback for manual browser preview |
| `task setup:labels` | Idempotently create/update the 7 `factory:*` GitHub labels via `gh` |

## Hard rules

1. Never commit or push directly on `main`. Always work on a feature branch or `factory/issue-<N>` worktree and stop at an open PR.
2. Never add `package.json`, `node_modules/`, build bundlers, or external CDN dependencies inside `sites/<slug>/`.
3. Never reference external URLs (CDNs, tracking scripts, external images) in site HTML/CSS/JS; Playwright Gate #3 rejects any outbound network request.
4. No secrets in files, sites, commits, or PRs (`gitleaks` enforces this in pre-commit and CI).
5. Pin every tool (`mise.toml`), npm package (`package.json` + `package-lock.json`), and GitHub Action (full commit SHA).
6. Scripts follow `.claude/rules/scripts.md`: bash with `set -euo pipefail`, shellcheck clean, deterministic PASS/WARN/FAIL reporting.
7. Playwright verifies navigation and footer content against `spec.json`, checks child-element overflow at desktop and mobile sizes, enforces WCAG 2.1 AA accessibility & color contrast via `@axe-core/playwright`, and supports `STRICT_COPY=1` to catch prompt leaks and stub cards.

## Review role

| Role | Use it | Checklist |
| --- | --- | --- |
| Site verifier | Before committing or opening a PR | `.claude/agents/site-verifier.md` |

## Definition of done

- `task ci` passes cleanly (0 failures, `gitleaks` clean).
- Every changed site under `sites/<slug>/` passes `SITE_SLUG=<slug> task test` and has fresh `evidence/desktop.png` and `evidence/mobile.png`.
- Stop at an open pull request; never merge your own PR.
