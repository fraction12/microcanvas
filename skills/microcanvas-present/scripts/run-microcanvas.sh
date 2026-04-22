#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$REPO_ROOT"

if [ ! -f "dist/cli/index.js" ]; then
  if [ ! -d "node_modules" ]; then
    npm install
  fi
  npm run build
fi

exec node dist/cli/index.js "$@"
