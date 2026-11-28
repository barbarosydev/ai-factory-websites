#!/usr/bin/env bash
# Idempotently create or update the 7 factory:* workflow labels in GitHub.
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "$0")/lib/common.sh"
cd "$REPO_ROOT"
require_cmd gh

labels=(
  "factory:ready|0E8A16|Eligible for intake into the AI Software Factory queue"
  "factory:running|1D76DB|Currently running inside Temporal IssueFactoryWorkflow"
  "factory:waiting|FBCA04|Paused in Temporal awaiting human clarification comment"
  "factory:review|5319E7|Verification passed; PR is open awaiting human merge"
  "factory:done|0E8A16|Factory pull request merged and issue completed"
  "factory:failed|D93F0B|Verification failed after bounded repair attempts"
  "factory:rejected|D4C5F9|Request rejected cleanly as outside factory v1 scope"
)

for entry in "${labels[@]}"; do
  IFS='|' read -r name color desc <<<"$entry"
  gh label create "$name" --color "$color" --description "$desc" --force
  info "synced label $name"
done
