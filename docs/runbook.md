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

Run the 8-gate Playwright verification suite (`tests/site.spec.mjs`) against any site under `sites/<slug>/`:

```bash
SITE_SLUG=_template task test
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
