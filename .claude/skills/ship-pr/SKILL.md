---
name: ship-pr
description: Verify branch hygiene, task ci, site Playwright tests, and open a clean PR.
---

# Verify and ship a pull request

1. Run `git status -sb` and verify you are not on `main`.
2. Run `ALL_SITES=1 task ci` and confirm all checks and Playwright suites pass.
3. Stage intentional changes, commit with a conventional commit message, and push your branch.
4. Open a PR with `gh pr create --base main --head <branch>` using `.github/pull_request_template.md`.
