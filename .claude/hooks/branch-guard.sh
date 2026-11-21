#!/usr/bin/env bash
# PreToolUse hook for Bash: keep commits and pushes off main.
set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
cmd="$(jq -r '.tool_input.command // empty' <<<"$input")"
git_sub='(^|[;&|(`[:space:]])git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)*[[:space:]]+'
grep -Eq "${git_sub}(commit|push)([[:space:]]|$)" <<<"$cmd" || exit 0

dir="$(jq -r '.cwd // empty' <<<"$input")"
[[ -n "$dir" && -d "$dir" ]] || dir="${CLAUDE_PROJECT_DIR:-.}"
branch="$(git -C "$dir" branch --show-current 2>/dev/null || true)"

if [[ "$branch" == "main" ]]; then
  echo "Blocked by .claude/hooks/branch-guard.sh: main is checked out." >&2
  echo "Switch to a feature or factory/issue-<N> branch before committing or pushing." >&2
  exit 2
fi

if grep -Eq "${git_sub}push([[:space:]].*)?[[:space:]](origin[[:space:]]+)?([^[:space:]]*:)?(refs/heads/)?main([[:space:]]|$)" <<<"$cmd"; then
  echo "Blocked by .claude/hooks/branch-guard.sh: never push directly to main; open a pull request." >&2
  exit 2
fi
exit 0
