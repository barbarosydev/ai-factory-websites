#!/usr/bin/env bash
# Run hook unit tests and Playwright site verification.
# Usage:
#   SITE_SLUG=_template ./scripts/test.sh
#   ALL_SITES=1 ./scripts/test.sh
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "$0")/lib/common.sh"
cd "$REPO_ROOT"

info "hook tests"
"$REPO_ROOT/tests/hooks/run.sh"

require_cmd node npx
if [[ ! -d "$REPO_ROOT/node_modules/@playwright/test" ]]; then
  die "Playwright not installed: run npm ci && npx playwright install chromium"
fi

if [[ "${ALL_SITES:-0}" == "1" ]]; then
  for dir in "$REPO_ROOT"/sites/*/; do
    [[ -d "$dir" ]] || continue
    slug="$(basename "$dir")"
    info "playwright site check: $slug"
    SITE_SLUG="$slug" npx playwright test "$@"
  done
else
  slug="${SITE_SLUG:-_template}"
  info "playwright site check: $slug"
  SITE_SLUG="$slug" npx playwright test "$@"
fi
