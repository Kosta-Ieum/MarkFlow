#!/usr/bin/env bash
# PostToolUse(Edit|Write) 훅 — 변경 파일 포맷/린트.
# 스택 확정 전이므로 도구가 설치돼 있을 때만 실행하고, 없으면 조용히 통과(빌드 깨짐 방지).
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"

# prettier가 설치돼 있으면 활성화 (TODO: 변경 파일만 대상으로 좁히기)
if command -v pnpm >/dev/null 2>&1 && pnpm exec prettier --version >/dev/null 2>&1; then
  : # pnpm exec prettier --write "<changed file>"
fi

# eslint가 설치돼 있으면 활성화
if command -v pnpm >/dev/null 2>&1 && pnpm exec eslint --version >/dev/null 2>&1; then
  : # pnpm exec eslint --fix "<changed file>"
fi

exit 0
