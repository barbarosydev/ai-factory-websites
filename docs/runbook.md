# Operations Runbook

## Commands

| Command | Use |
| --- | --- |
| `task lint` | Run shellcheck, ruff, JSON/YAML checks, Conftest policies, actionlint, and doc checks |
| `task test` | Run hook tests and Playwright site verification (`SITE_SLUG=<slug>` or `ALL_SITES=1`) |
| `task ci` | Run `task lint`, `task test`, and `gitleaks` secret scan |
| `task preview` | Serve `sites/<SITE_SLUG>/` locally on loopback for browser preview |
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
