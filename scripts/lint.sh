#!/usr/bin/env bash
# Lint shell scripts, JSON/YAML files, Conftest policies, GitHub Actions, and site structure.
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "$0")/lib/common.sh"
cd "$REPO_ROOT"

failed=0
run() {
  local name="$1"
  shift
  if "$@"; then
    printf '%sPASS%s  %s\n' "$C_GREEN" "$C_RESET" "$name"
  else
    printf '%sFAIL%s  %s\n' "$C_RED" "$C_RESET" "$name"
    failed=1
  fi
}

tracked() { git ls-files --cached --others --exclude-standard -- "$@"; }

require_cmd shellcheck jq yq conftest actionlint

shell_files="$(tracked '*.sh')"
if [[ -n "$shell_files" ]]; then
  # shellcheck disable=SC2086
  run "shellcheck ($(wc -l <<<"$shell_files" | tr -d ' ') files)" shellcheck -x $shell_files
fi

# shellcheck disable=SC2317,SC2329
yaml_ok() { yq eval 'true' "$1" >/dev/null; }
while IFS= read -r f; do
  [[ -n "$f" ]] && run "json $f" jq empty "$f"
done <<<"$(tracked '*.json')"
while IFS= read -r f; do
  [[ -n "$f" ]] && run "yaml $f" yaml_ok "$f"
done <<<"$(tracked '*.yml' '*.yaml')"

# Ensure no site under sites/ contains forbidden npm/package files
# shellcheck disable=SC2317,SC2329
no_per_site_npm() {
  local bad
  bad="$(find sites -maxdepth 3 \( -name 'package.json' -o -name 'package-lock.json' -o -name 'node_modules' \) 2>/dev/null || true)"
  [[ -z "$bad" ]] || { echo "forbidden per-site npm files: $bad" >&2; return 1; }
}
run "site dependency isolation (no per-site package.json)" no_per_site_npm

run "conftest verify (policy unit tests)" conftest verify --no-color --policy policy
# shellcheck disable=SC2046
run "policy: workflows read-only and SHA-pinned" conftest test --no-color --policy policy --namespace github $(tracked '.github/workflows/*.yml')
run "policy: Claude Code deny rules and guard hooks" conftest test --no-color --policy policy --namespace claude .claude/settings.json
run "actionlint" actionlint -no-color

exit "$failed"
