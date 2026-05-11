#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT=""
TITLE=""
PRIORITY="5"
BODY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      PROJECT="$2"
      shift 2
      ;;
    --title)
      TITLE="$2"
      shift 2
      ;;
    --priority)
      PRIORITY="$2"
      shift 2
      ;;
    --body)
      BODY="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ "$PROJECT" = "" ] || [ "$TITLE" = "" ]; then
  echo "Usage: scripts/bug-add.sh --project slug --title title [--priority 8] [--body text]" >&2
  exit 1
fi

if [ "$BODY" = "" ]; then
  BODY="$(cat)"
fi

node "$ROOT/scripts/os-cli.js" bug-add "$PROJECT" "$TITLE" "$PRIORITY" "$BODY"
