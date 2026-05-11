#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT=""
SOURCE_AI="other"
TEXT=""
FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      PROJECT="$2"
      shift 2
      ;;
    --source|--source-ai)
      SOURCE_AI="$2"
      shift 2
      ;;
    --text)
      TEXT="$2"
      shift 2
      ;;
    --file)
      FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ "$PROJECT" = "" ]; then
  echo "Missing --project" >&2
  exit 1
fi

if [ "$TEXT" = "" ] && [ "$FILE" != "" ]; then
  TEXT="$(cat "$FILE")"
fi

if [ "$TEXT" = "" ]; then
  TEXT="$(cat)"
fi

node "$ROOT/scripts/os-cli.js" ai-save "$PROJECT" "$SOURCE_AI" "$TEXT"
