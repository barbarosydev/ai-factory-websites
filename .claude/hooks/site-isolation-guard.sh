#!/usr/bin/env bash
# PreToolUse hook for Write/Edit: keep site edits scoped and dependency-free.
# - Blocks placing package.json, package-lock.json, or node_modules inside sites/<slug>/.
# - When SITE_TARGET_SLUG is set in env, blocks edits to any other sites/<other>/ directory.
set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0

payload="$(cat)"
file_path="$(jq -r '.tool_input.file_path // empty' <<<"$payload")"
[[ -z "$file_path" ]] && exit 0

if grep -Eq '(^|/)sites/[^/]+/(.*/)?(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|node_modules(/|$))' <<<"$file_path"; then
  echo "Blocked by .claude/hooks/site-isolation-guard.sh: per-site npm files are forbidden under sites/; Playwright lives only at repo root." >&2
  exit 2
fi

if [[ -n "${SITE_TARGET_SLUG:-}" ]] && grep -Eq '(^|/)sites/[^/]+/' <<<"$file_path"; then
  slug="$(sed -n 's#.*sites/\([^/]*\)/.*#\1#p' <<<"$file_path")"
  if [[ -n "$slug" && "$slug" != "$SITE_TARGET_SLUG" ]]; then
    echo "Blocked by .claude/hooks/site-isolation-guard.sh: target site is '$SITE_TARGET_SLUG', cannot edit 'sites/$slug/'." >&2
    exit 2
  fi
fi
exit 0
