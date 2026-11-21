# Prerequisites

Set up a Mac for `ai-factory-websites` in three steps.

## 1. Homebrew packages

From the repository root, install `mise` and the GitHub CLI (`gh`):

```bash
brew bundle --no-upgrade
```

## 2. Pinned CLI tools (`mise`)

`mise.toml` pins the exact versions of Node, Task, Conftest, ShellCheck, actionlint, jq, yq, pre-commit, and gitleaks used both locally and in GitHub Actions:

```bash
mise install
```

## 3. Playwright browser and commit hook

Install the shared root Playwright dependency, headless Chromium, and the pre-commit hook:

```bash
npm ci
npx playwright install chromium
pre-commit install
```

Verify everything passes locally:

```bash
ALL_SITES=1 task ci
```
