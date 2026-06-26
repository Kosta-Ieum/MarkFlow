#!/usr/bin/env bash
# 역할별 로컬 스코프 가드 — .claude/settings.local.json(gitignore됨, 개인 PC 전용) 생성.
# BE는 apps/api만, FE(F1·F2)는 apps/web만 편집하도록 Claude Code가 막는다.
# 사용: scripts/set-role.sh <BE|F1|F2>
set -euo pipefail
cd "$(dirname "$0")/.."

ROLE="${1:-}"
case "$ROLE" in
  BE)
    SCOPE="apps/api + packages/shared (apps/web 편집 차단)"
    DENY='"Edit(apps/web/**)", "Write(apps/web/**)"'
    ;;
  F1|F2|FE)
    SCOPE="apps/web + packages/shared (apps/api·prisma 편집 차단)"
    DENY='"Edit(apps/api/**)", "Write(apps/api/**)"'
    ;;
  *)
    echo "사용법: scripts/set-role.sh <BE|F1|F2>" >&2
    exit 1
    ;;
esac

mkdir -p .claude
cat > .claude/settings.local.json <<JSON
{
  "//": "역할별 로컬 스코프 가드 (scripts/set-role.sh 생성, gitignore됨). 역할: ${ROLE}",
  "permissions": {
    "deny": [ ${DENY} ]
  }
}
JSON

# 도구 무관 가드: git hook(.githooks/pre-commit)이 읽는 역할도 함께 기록 → 자율 에이전트·맨손 git에도 적용.
git config markflow.role "${ROLE}"

echo "✔ 역할 '${ROLE}' 적용 → .claude/settings.local.json + git config markflow.role"
echo "  스코프: ${SCOPE}"
echo "  - Claude Code: 재시작 시 적용(개인 PC 전용 — git에 안 올라감)."
echo "  - git hook(pre-commit): 즉시 적용 — 범위 밖 경로 커밋 차단(모든 도구)."
