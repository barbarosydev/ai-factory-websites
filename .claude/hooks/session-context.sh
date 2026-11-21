#!/usr/bin/env bash
# SessionStart hook: report branch and uncommitted count cleanly.
set -uo pipefail

dir=""
if command -v jq >/dev/null 2>&1 && [[ ! -t 0 ]]; then
  dir="$(jq -r '.cwd // empty' 2>/dev/null || true)"
fi
[[ -n "$dir" && -d "$dir" ]] || dir="${CLAUDE_PROJECT_DIR:-.}"
cd "$dir" 2>/dev/null || exit 0
branch="$(git branch --show-current 2>/dev/null)" || exit 0
changes="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

echo "Checkout: branch ${branch:-detached HEAD}, ${changes} uncommitted file(s)."
if [[ "$branch" == "main" ]]; then
  echo "main is checked out: create a branch before changing files (branch-guard blocks commits on main)."
fi
exit 0
