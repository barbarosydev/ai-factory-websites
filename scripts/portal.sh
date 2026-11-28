#!/usr/bin/env bash
# Build the static Showcase Portal bundle in dist/ from sites/*/spec.json.
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "$0")/lib/common.sh"
cd "$REPO_ROOT"

require_cmd node
node "$REPO_ROOT/scripts/build-portal.mjs" "$@"
