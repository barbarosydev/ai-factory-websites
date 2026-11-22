# Security Policy

## Scope and Posture

`ai-factory-websites` is a public monorepo of static single-page websites generated and verified by [`ai-factory`](https://github.com/barbarosydev/ai-factory).

- **Zero External Network Dependencies**: Every site under `sites/<slug>/` uses plain semantic HTML5, CSS, and optional vanilla ES6 JS. Playwright Gate #3 (`tests/site.spec.mjs`) blocks and fails on any external network request.
- **Zero Per-Site Packages**: Individual sites never contain `package.json`, `package-lock.json`, `node_modules/`, or build scripts (`scripts/lint.sh` and `.claude/hooks/site-isolation-guard.sh` enforce this).
- **Loopback `/sites/` Jailing**: `scripts/serve.mjs` binds strictly to `127.0.0.1` and serves only files inside `sites/` (plus `/__health`).
- **Authorized Automation Intake**: Issue and comment triggers are gated by the `ai-factory` control plane's GitHub user allowlist (`FACTORY_ALLOWED_GITHUB_USERS`).

## Automated Security Gates

Every commit and Pull Request is gated by `task ci` (`scripts/ci.sh`):

1. **Conftest (OPA Rego) Policies** (`policy/`): Enforces read-only GitHub Actions tokens, 40-char commit-SHA-pinned actions, and Claude Code deny rules/hooks.
2. **Offline Playwright Verification** (`tests/site.spec.mjs`): Verifies zero outbound network requests, zero console/page errors, and path isolation.
3. **Secret Scanning** (`gitleaks`): Scans staged changes in `pre-commit` and full git history in CI.

## Reporting a Vulnerability

Please report security issues privately via [GitHub Security Advisories](https://github.com/barbarosydev/ai-factory-websites/security/advisories/new) rather than opening a public issue.
