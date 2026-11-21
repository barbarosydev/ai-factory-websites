#!/usr/bin/env bash
# PreToolUse hook for Write/Edit: block content that looks like a key, token, or password.
set -euo pipefail

command -v gitleaks >/dev/null 2>&1 || exit 0
command -v jq >/dev/null 2>&1 || exit 0

payload="$(cat)"
content="$(jq -r '
  .tool_input
  | [.content, .new_string, (.edits // [] | .[].new_string)]
  | map(select(. != null))
  | join("\n")
' <<<"$payload")"

[[ -z "$content" ]] && exit 0

if ! printf '%s' "$content" | gitleaks stdin --no-banner --redact --log-level error --exit-code 1 >/dev/null 2>&1; then
  file="$(jq -r '.tool_input.file_path // "the file"' <<<"$payload")"
  echo "Blocked by .claude/hooks/secret-guard.sh: the content for $file looks like a secret (gitleaks)." >&2
  exit 2
fi
