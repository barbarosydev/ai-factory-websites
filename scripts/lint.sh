#!/usr/bin/env bash
# Lint shell scripts, Python helpers, JS syntax, JSON/YAML & spec.json schemas, Conftest policies, GitHub Actions, site isolation, and doc links.
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

require_cmd shellcheck ruff jq yq conftest actionlint node

shell_files="$(tracked '*.sh')"
if [[ -n "$shell_files" ]]; then
  # shellcheck disable=SC2086
  run "shellcheck ($(wc -l <<<"$shell_files" | tr -d ' ') files)" shellcheck -x $shell_files
fi

py_files="$(tracked '*.py')"
if [[ -n "$py_files" ]]; then
  # shellcheck disable=SC2086
  run "ruff check ($(wc -l <<<"$py_files" | tr -d ' ') files)" ruff check --quiet $py_files
  # shellcheck disable=SC2086
  run "ruff format --check" ruff format --check --quiet $py_files
fi

# shellcheck disable=SC2317,SC2329
js_syntax_ok() {
  local f
  for f in "$@"; do
    node --check "$f" || return 1
  done
}
js_files="$(tracked '*.js' '*.mjs')"
if [[ -n "$js_files" ]]; then
  # shellcheck disable=SC2086
  run "node --check ($(wc -l <<<"$js_files" | tr -d ' ') JS/MJS files)" js_syntax_ok $js_files
fi

# shellcheck disable=SC2317,SC2329
yaml_ok() { yq eval 'true' "$1" >/dev/null; }
while IFS= read -r f; do
  [[ -n "$f" ]] && run "json $f" jq empty "$f"
done <<<"$(tracked '*.json')"
while IFS= read -r f; do
  [[ -n "$f" ]] && run "yaml $f" yaml_ok "$f"
done <<<"$(tracked '*.yml' '*.yaml')"

# Validate every sites/*/spec.json schema and slug consistency
# shellcheck disable=SC2317,SC2329
validate_site_specs() {
  local spec dir slug
  for dir in "$REPO_ROOT"/sites/*/; do
    [[ -d "$dir" ]] || continue
    slug="$(basename "$dir")"
    spec="${dir}spec.json"
    [[ -f "$spec" ]] || { echo "missing spec.json for site $slug" >&2; return 1; }
    jq -e --arg slug "$slug" '
      .schema_version == "v1" and
      .site_slug == $slug and
      (.page_title | type == "string" and length > 0) and
      (.footer_text | type == "string" and length > 0) and
      (.navigation | type == "array" and length > 0) and
      (.sections | type == "array" and length >= 3 and length <= 8) and
      (.theme.primary_color | test("^#[0-9A-Fa-f]{6}$")) and
      (.theme.background_color | test("^#[0-9A-Fa-f]{6}$")) and
      (.theme.accent_color | test("^#[0-9A-Fa-f]{6}$"))
    ' "$spec" >/dev/null || { echo "invalid spec.json schema in sites/$slug/spec.json" >&2; return 1; }
  done
}
run "site spec.json schema validation" validate_site_specs

# Ensure no site under sites/ contains forbidden npm/package files at any depth
# shellcheck disable=SC2317,SC2329
no_per_site_npm() {
  local bad
  bad="$(find sites \( -name 'package.json' -o -name 'package-lock.json' -o -name 'yarn.lock' -o -name 'pnpm-lock.yaml' -o -name 'node_modules' \) 2>/dev/null || true)"
  [[ -z "$bad" ]] || { echo "forbidden per-site package files: $bad" >&2; return 1; }
}
run "site dependency isolation (no per-site package.json)" no_per_site_npm

# Static external URL scan across all site HTML/CSS/JS/SVG files
# shellcheck disable=SC2317,SC2329
no_external_site_assets() {
  local hits
  hits="$(grep -rnE "(src|href)=['\"]?(https?:|//)|url\(['\"]?(https?:|//)|@import[[:space:]]+['\"]?(https?:|//)" sites --include='*.html' --include='*.css' --include='*.js' --include='*.svg' 2>/dev/null || true)"
  [[ -z "$hits" ]] || { echo "disallowed external asset URLs in sites/: $hits" >&2; return 1; }
}
run "static external asset URL scan (sites/)" no_external_site_assets

run "conftest verify (policy unit tests)" conftest verify --no-color --policy policy
# shellcheck disable=SC2046
run "policy: workflows read-only and SHA-pinned" conftest test --no-color --policy policy --namespace github $(tracked '.github/workflows/*.yml')
run "policy: Claude Code deny rules and guard hooks" conftest test --no-color --policy policy --namespace claude .claude/settings.json
run "actionlint" actionlint -no-color

# shellcheck disable=SC2317,SC2329
public_oss_governance() {
  local f
  for f in LICENSE SECURITY.md .github/CODEOWNERS; do
    [[ -s "$REPO_ROOT/$f" ]] || {
      echo "missing or empty required public OSS governance file: $f" >&2
      return 1
    }
  done
}

run "public OSS governance (LICENSE, SECURITY.md, .github/CODEOWNERS)" public_oss_governance
run "doc links and paths" "$REPO_ROOT/scripts/lib/check_links.py"
run "task commands in AGENTS.md and docs/runbook.md" "$REPO_ROOT/scripts/lib/check_commands.py"

exit "$failed"
