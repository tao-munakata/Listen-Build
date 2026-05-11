#!/usr/bin/env bash
set -euo pipefail

PROJECT=""
SOURCE_AI="webhook"
TOKEN="${AI_DEV_OS_WEBHOOK_TOKEN:-}"
TEXT=""

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
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --text)
      TEXT="$2"
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

if [ "$TEXT" = "" ]; then
  TEXT="$(cat)"
fi

node "$(dirname "$0")/webhook-save.js" "$PROJECT" "$SOURCE_AI" "$TOKEN" "$TEXT"
