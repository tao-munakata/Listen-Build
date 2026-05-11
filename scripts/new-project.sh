#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/new-project.sh \"Project Name\" [description]" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="$1"
DESCRIPTION="${2:-}"

node "$ROOT/scripts/os-cli.js" new-project "$NAME" "$DESCRIPTION"
