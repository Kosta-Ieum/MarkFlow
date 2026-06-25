#!/usr/bin/env bash
# git lb <IEUM-13> — Linear 이슈 ID로 Linear가 만든 브랜치명을 가져와 로컬 브랜치 생성·체크아웃.
# Linear 브랜치명을 그대로 써서 PR↔이슈 자동 링크 확률을 높인다.
# 필요: .env 의 LINEAR_API_KEY (Linear Settings → API → Personal API key)
set -euo pipefail
cd "$(dirname "$0")/.."

ID="${1:-}"
[ -z "$ID" ] && { echo "사용법: git lb <IEUM-13>" >&2; exit 1; }

# LINEAR_API_KEY 로드(.env에서 해당 줄만)
if [ -z "${LINEAR_API_KEY:-}" ] && [ -f .env ]; then
  # 값만 추출: 접두 제거 → 인라인 주석 제거 → 양끝 따옴표 제거
  LINEAR_API_KEY=$(grep -E '^LINEAR_API_KEY=' .env | head -1 \
    | sed -E 's/^LINEAR_API_KEY=[[:space:]]*//; s/[[:space:]]*#.*$//; s/^"//; s/"$//; s/^'\''//; s/'\''$//')
fi
: "${LINEAR_API_KEY:?LINEAR_API_KEY 미설정 — .env에 LINEAR_API_KEY=... 추가하세요}"

# IEUM-13 → team=IEUM, number=13
TEAM="${ID%-*}"
NUM="${ID##*-}"

# Linear GraphQL 호출 (python stdlib — 추가 의존성 없음)
INFO=$(LINEAR_API_KEY="$LINEAR_API_KEY" python3 - "$TEAM" "$NUM" <<'PY'
import sys, os, json, urllib.request
team, num = sys.argv[1], int(sys.argv[2])
q = "query($key:String!,$num:Float!){issues(filter:{team:{key:{eq:$key}},number:{eq:$num}}){nodes{identifier title branchName url}}}"
body = json.dumps({"query": q, "variables": {"key": team, "num": num}}).encode()
req = urllib.request.Request("https://api.linear.app/graphql", data=body,
    headers={"Authorization": os.environ["LINEAR_API_KEY"], "Content-Type": "application/json"})
try:
    r = json.load(urllib.request.urlopen(req))
except Exception as e:
    sys.stderr.write("Linear API 호출 실패: %s\n" % e); sys.exit(3)
nodes = ((r.get("data") or {}).get("issues") or {}).get("nodes", [])
if not nodes:
    sys.stderr.write("이슈를 못 찾음(권한/ID 확인): %s\n" % json.dumps(r.get("errors") or r, ensure_ascii=False)); sys.exit(2)
i = nodes[0]
print("%s\t%s\t%s" % (i["branchName"], i.get("title", ""), i.get("url", "")))
PY
)

BRANCH=$(printf '%s' "$INFO" | cut -f1)
TITLE=$(printf '%s' "$INFO" | cut -f2)
URL=$(printf '%s' "$INFO" | cut -f3)

echo "▸ ${ID}: ${TITLE}"
echo "▸ 브랜치: ${BRANCH}"
echo "▸ ${URL}"

git fetch -q origin
if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  git switch "${BRANCH}"
  echo "✔ 기존 브랜치로 전환: ${BRANCH}"
else
  git switch -c "${BRANCH}" origin/main
  echo "✔ origin/main 기준 새 브랜치 생성·체크아웃: ${BRANCH}"
fi
