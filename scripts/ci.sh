#!/usr/bin/env bash
# Run lint, tests, and gitleaks secret scan (shared between pre-commit and GitHub Actions).
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "$0")/lib/common.sh"
cd "$REPO_ROOT"

mode="history"
for arg in "$@"; do
  case "$arg" in
    --staged) mode="staged" ;;
    *) die "unknown argument: $arg" ;;
  esac
done

info "lint"
"$REPO_ROOT/scripts/lint.sh"

info "test"
"$REPO_ROOT/scripts/test.sh"

require_cmd gitleaks
if [[ "$mode" == "staged" ]]; then
  info "secret scan (staged changes)"
  gitleaks git --staged --redact --no-banner --exit-code 1 .
else
  info "secret scan (whole history)"
  gitleaks git --redact --no-banner --exit-code 1 .
fi
