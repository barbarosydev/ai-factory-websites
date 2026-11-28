#!/usr/bin/env bash
# Run hook unit tests and Playwright site verification (11 quality gates, STRICT_COPY=1 by default).
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

export STRICT_COPY="${STRICT_COPY:-1}"

if [[ "${ALL_SITES:-0}" == "1" && -z "${SITE_SLUG:-}" ]]; then
  info "playwright site check: ALL_SITES=1 (single Chromium session, STRICT_COPY=$STRICT_COPY)"
  ALL_SITES=1 npx playwright test "$@"
else
  slug="${SITE_SLUG:-_template}"
  info "playwright site check: $slug (STRICT_COPY=$STRICT_COPY)"
  SITE_SLUG="$slug" npx playwright test "$@"
fi
