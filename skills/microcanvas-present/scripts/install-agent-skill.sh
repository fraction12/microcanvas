#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

TARGETS=(
  ".agents/skills/microcanvas-present"
  ".claude/skills/microcanvas-present"
  ".codex/skills/microcanvas-present"
  ".cursor/skills/microcanvas-present"
)

for rel in "${TARGETS[@]}"; do
  dest="$REPO_ROOT/$rel"
  parent="$(dirname "$dest")"
  mkdir -p "$parent"
  rm -rf "$dest"
  ln -s "../../skills/microcanvas-present" "$dest"
  echo "symlinked $rel -> ../../skills/microcanvas-present"
done
