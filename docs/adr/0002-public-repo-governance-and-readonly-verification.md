# 0002. Public repository governance, `/sites/` loopback isolation, and read-only Playwright verification

## Status

Accepted

## Date

2026-11-22

## Context

`ai-factory-websites` is a public GitHub repository. Two operational and security details needed hardening:

1. `scripts/serve.mjs` served the entire repository root (`process.cwd()`) on `127.0.0.1:4173`, exposing non-site files during local preview or Playwright runs.
2. `tests/site.spec.mjs` unconditionally overwrote tracked `sites/<slug>/evidence/{desktop,mobile}.png` on every `task test` and `task ci` run, dirtying the git working tree during read-only verification.
3. Public open-source governance files (`LICENSE`, `SECURITY.md`, `.github/CODEOWNERS`) were not enforced in `task lint`.

## Decision

- Restrict `scripts/serve.mjs` to serve only files under `sites/` (plus `/__health`), returning `403 Forbidden` for any other path.
- Make `tests/site.spec.mjs` read-only on tracked `sites/<slug>/evidence/*.png` by default (writing verification screenshots to gitignored `test-results/evidence/<slug>/` while asserting committed evidence exists), and overwrite `sites/<slug>/evidence/{desktop,mobile}.png` only when `WRITE_EVIDENCE=1` is set (or when initial evidence does not exist yet).
- Run all sites (`ALL_SITES=1`) by default during `scripts/ci.sh` when `SITE_SLUG` is not set.
- Commit MIT `LICENSE`, `SECURITY.md`, and `.github/CODEOWNERS`, and enforce their presence and ADR index synchronization (`docs/adr/README.md`) in `scripts/lint.sh`.

## Consequences

- Running `task test` or `task ci` leaves `git status` clean while still verifying fresh screenshot rendering.
- `WRITE_EVIDENCE=1 SITE_SLUG=<slug> task test` explicitly refreshes tracked evidence PNGs when a site is created or updated.
