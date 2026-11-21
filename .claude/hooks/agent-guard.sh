#!/usr/bin/env bash
# PreToolUse hook for Bash: keep read-only verification agents read-only.
set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
agent="$(jq -r '.agent_type // empty' <<<"$input")"
case "$agent" in
  site-verifier) ;;
  *) exit 0 ;;
esac
cmd="$(jq -r '.tool_input.command // empty' <<<"$input")"

b='(^|[;&|(`[:space:]])'
mutating=(
  "${b}task[[:space:]]+setup:labels"
  "${b}git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)*[[:space:]]+(add|commit|push|rm|mv|reset|checkout|switch|restore|stash|merge|rebase|cherry-pick|revert|tag|clean|worktree|pull|fetch)([[:space:]]|$)"
  "${b}gh[[:space:]]+(pr|issue|release|repo|workflow|run)[[:space:]]+(create|merge|close|edit|delete|comment|review|reopen|rerun|cancel|run)([[:space:]]|$)"
  "${b}(rm|mv|truncate|tee|chmod|chown)[[:space:]]"
  "${b}sed[[:space:]]+(.*[[:space:]])?-i"
)
for re in "${mutating[@]}"; do
  if grep -Eq "$re" <<<"$cmd"; then
    echo "Blocked by .claude/hooks/agent-guard.sh: the $agent agent is read-only." >&2
    exit 2
  fi
done
exit 0
