# shellcheck shell=bash
# Shared helpers for scripts/. Source it; do not run it.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export REPO_ROOT

if command -v mise >/dev/null 2>&1 && [[ -f "$REPO_ROOT/mise.toml" ]]; then
  eval "$(mise env -s bash -C "$REPO_ROOT" 2>/dev/null || true)" # mise env absent: keep PATH
fi

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_GREEN=$'\033[32m' C_YELLOW=$'\033[33m' C_RED=$'\033[31m' C_RESET=$'\033[0m'
else
  C_GREEN="" C_YELLOW="" C_RED="" C_RESET=""
fi
export C_GREEN C_YELLOW C_RED C_RESET

info() { printf '==> %s\n' "$*" >&2; }
warn() { printf '%sWARN%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die() { printf '%sFAIL%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

require_cmd() {
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || die "$cmd is not installed: run mise install"
  done
}
