# Operations Runbook

## Commands

| Command | Use |
| --- | --- |
| `task lint` | Run shellcheck, ruff, JS/spec.json checks, external-URL scan, Conftest policies, actionlint, and doc checks |
| `task test` | Run hook tests and 11 Playwright + WCAG 2.1 AA quality gates (`SITE_SLUG=<slug>` or `ALL_SITES=1`) |
| `task ci` | Run `task lint`, `task test`, and `gitleaks` secret scan |
| `task preview` | Serve the interactive Showcase Portal (default) or `sites/<SITE_SLUG>/` locally (`-- --open` launches browser) |
| `task portal` | Build the static Showcase Portal bundle in `dist/` from `sites/*/spec.json` |
| `task setup:labels` | Create or update all 7 `factory:*` labels on GitHub using `gh` |

## Verifying a Site Locally

Run the Playwright verification suite (`tests/site.spec.mjs`) against any site under `sites/<slug>/`. It checks navigation and footer content against `spec.json`, desktop/mobile child-element overflow, and (with `STRICT_COPY=1`) prompt leaks and stub cards. Tests are read-only by default; pass `WRITE_EVIDENCE=1` only when intentionally creating or refreshing tracked screenshots:

```bash
SITE_SLUG=_template task test
STRICT_COPY=1 SITE_SLUG=_template task test
WRITE_EVIDENCE=1 SITE_SLUG=_template task test
```

To verify every site in `sites/` in a single pass:

```bash
ALL_SITES=1 task ci
```

## Previewing a Site in Your Browser

```bash
SITE_SLUG=_template task preview
```

## Syncing GitHub `factory:*` Labels

```bash
task setup:labels
```
