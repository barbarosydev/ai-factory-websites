#!/usr/bin/env bash
# Unit tests for .claude/hooks/
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=scripts/lib/common.sh
source "$REPO_ROOT/scripts/lib/common.sh"

while IFS= read -r git_var; do
  [[ -n "$git_var" ]] && unset "$git_var"
done < <(git rev-parse --local-env-vars 2>/dev/null || true) # unset inherited git hook env vars in tests

failed=0
pass() { printf '%sPASS%s  %-22s %s\n' "$C_GREEN" "$C_RESET" "$1" "$2"; }
fail() { printf '%sFAIL%s  %-22s %s\n' "$C_RED" "$C_RESET" "$1" "$2"; failed=1; }

expect_hook() {
  local want="$1" hook="$2" label="$3" payload="$4" env_prefix="${5:-}"
  local rc=0
  if [[ -n "$env_prefix" ]]; then
    env "$env_prefix" CLAUDE_PROJECT_DIR="$REPO_ROOT" "$REPO_ROOT/.claude/hooks/$hook" <<<"$payload" >/dev/null 2>&1 || rc=$?
  else
    CLAUDE_PROJECT_DIR="$REPO_ROOT" "$REPO_ROOT/.claude/hooks/$hook" <<<"$payload" >/dev/null 2>&1 || rc=$?
  fi
  if [[ "$rc" -eq "$want" ]]; then
    pass "$hook" "$label"
  else
    fail "$hook" "$label (expected exit $want, got $rc)"
  fi
}

# site-isolation-guard.sh
expect_hook 2 "site-isolation-guard.sh" "blocks per-site package.json" '{"tool_input":{"file_path":"sites/coffee-shop/package.json"}}'
expect_hook 2 "site-isolation-guard.sh" "blocks nested per-site package.json" '{"tool_input":{"file_path":"sites/coffee-shop/nested/package.json"}}'
expect_hook 2 "site-isolation-guard.sh" "blocks per-site yarn.lock" '{"tool_input":{"file_path":"sites/coffee-shop/yarn.lock"}}'
expect_hook 2 "site-isolation-guard.sh" "blocks cross-site edit when SITE_TARGET_SLUG set" '{"tool_input":{"file_path":"sites/bakery/index.html"}}' "SITE_TARGET_SLUG=coffee-shop"
expect_hook 0 "site-isolation-guard.sh" "allows target site edit" '{"tool_input":{"file_path":"sites/coffee-shop/index.html"}}' "SITE_TARGET_SLUG=coffee-shop"

# secret-guard.sh (assemble fake token at runtime so this test file stays gitleaks-clean)
fake_pat="ghp_$(openssl rand -hex 18)"
expect_hook 2 "secret-guard.sh" "blocks GitHub PAT" "$(jq -cn --arg c "const t = \"$fake_pat\";" '{tool_input:{file_path:"sites/_template/script.js",content:$c}}')"
expect_hook 0 "secret-guard.sh" "allows normal HTML" '{"tool_input":{"file_path":"sites/_template/index.html","content":"<h1>Hello</h1>"}}'

# agent-guard.sh
expect_hook 2 "agent-guard.sh" "blocks mutating git in site-verifier" '{"agent_type":"site-verifier","tool_input":{"command":"git commit -m test"}}'
expect_hook 0 "agent-guard.sh" "allows task ci in site-verifier" '{"agent_type":"site-verifier","tool_input":{"command":"task ci"}}'

# branch-guard.sh
expect_hook 2 "branch-guard.sh" "blocks push to main" "{\"cwd\":\"$REPO_ROOT\",\"tool_input\":{\"command\":\"git push origin main\"}}"
expect_hook 0 "branch-guard.sh" "allows git status" "{\"cwd\":\"$REPO_ROOT\",\"tool_input\":{\"command\":\"git status -sb\"}}"

exit "$failed"
