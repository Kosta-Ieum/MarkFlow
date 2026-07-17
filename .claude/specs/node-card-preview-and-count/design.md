---
feature: node-card-preview-and-count
status: approved
created: 2026-07-17
---

# 노드 카드 md 미리보기 개선 + 생성 번호 고유화 — 기술 설계

## 1. 아키텍처 개요

**한 줄 요약**: 전부 `apps/web` 내 2개 파일 수준의 국소 수정 — ① `MarkdownNodeCard`의 펼침 렌더 블록에 라이트 테마 지정 + 높이 상한 + 잘림 감지, ② `canvasStore.applyLocalAddNode`의 기본 이름 계산 교체. BE·shared·openapi 변경 없음, 신규 의존성 없음.

```
[펼친 카드]                              [새 노드 생성]
MarkdownNodeCard 펼침 블록               applyLocalAddNode
 └ data-color-mode="light" (R1)          └ 새 노드 ${nodes.length+1}  ← 제거
 └ max-height + overflow-hidden (R2)     └ nextDefaultNodeNumber(nodes, trash) (R3)
 └ scrollHeight 측정 → 잘림 표시(R2.1/2.2)
```

## 2. 기술 선택과 이유

| 선택 | 무엇인가 | 왜 (대안 대비) |
|---|---|---|
| `data-color-mode="light"` 속성 지정 | MDEditor 렌더러가 다크/라이트를 판단할 때 참조하는 HTML 속성 | **이미 사내 검증된 패턴** — 노드 에디터(`node-editor/index.tsx:373`)·휴지통 패널(`TrashPanel.tsx:430`)이 같은 방식으로 흰 배경을 고정한다. 카드만 누락. CSS 오버라이드로 색을 일일이 덮는 대안보다 정확하고 짧다 |
| CSS `max-height` + `overflow-hidden` + JS 측정 | 상한을 넘는지는 렌더 후 실제 높이(`scrollHeight > clientHeight`)로 판단 | CSS `line-clamp`는 일반 텍스트 전용이라 마크다운 블록(코드·리스트·이미지)에는 안 통한다. "넘칠 때만 잘림 표시"(R2.2)를 지키려면 측정이 필수 — `ResizeObserver`(요소 크기 변화를 알려주는 브라우저 내장 API)로 내용 변경에도 추적 |
| 잘림 표시 = 하단 페이드 + ⋯ 배지 | 잘렸음을 보여주는 그라데이션 + 말줄임 기호 | 클릭 요소(더보기 버튼)를 추가하면 기존 더블클릭(에디터 진입)과 제스처가 충돌 — 표시만 하고 열람 경로는 기존 더블클릭 유지(R2.3) |
| 번호 = 화면+휴지통 "새 노드 N" 최대값+1 (클라이언트 계산) | 생성 시점에 제목을 정규식으로 훑어 최대 번호+1 | 서버 카운터(스키마 변경+마이그레이션)는 기본 이름 하나를 위해 과함. 눈에 보이는 노드·휴지통과 절대 안 겹침이 보장되고 BE 변경 0. 동시 생성 시 이론상 중복 가능하나 제목은 원래 중복 허용(요구사항 승인 시 수용) |

**상한 수치 제안**: `max-height: 240px` (text-xs 기준 본문 약 12~14줄). 카드 폭 186px 대비 세로로 과하지 않고, 접힘(≈88px)과 확실히 구분되는 크기. 구현 후 실화면 보고 조정 가능(상수 하나).

## 3. 컴포넌트와 인터페이스

### MarkdownNodeCard 펼침 블록 (수정: `features/canvas/MarkdownNodeCard.tsx`)
- 펼침 분기의 래퍼 `div`에:
  - `data-color-mode="light"` (R1.1)
  - `relative max-h-[240px] overflow-hidden` (R2.1)
  - 가로 넘침 가드(R2.4): `[&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_img]:max-w-full` — 코드/표는 카드 안에서 가로 스크롤, 이미지는 폭 맞춤
- 잘림 감지 훅: `ref` + `ResizeObserver`로 `scrollHeight > clientHeight` → `isClamped` state (R2.1/R2.2)
- `isClamped`일 때만 하단에 절대배치 페이드(카드 배경색 그라데이션) + `⋯` 표시 렌더
- 더블클릭 진입(`handleEnterEdit`)은 무변경 (R2.3)
- **근거 요구사항**: R1.1, R1.2, R2.1~R2.4

### nextDefaultNodeNumber (신규 헬퍼: `store/canvasStore.ts` 내 모듈 함수)
```ts
const DEFAULT_NODE_TITLE = /^새 노드 (\d+)$/;
function nextDefaultNodeNumber(titled: { data: { title: string } }[]): number {
  // nodes ∪ trashedNodes의 "새 노드 <숫자>" 제목 중 최대 번호 + 1 (없으면 1)
}
```
- `applyLocalAddNode`에서 `새 노드 ${nodes.length + 1}` → `새 노드 ${nextDefaultNodeNumber([...nodes, ...trashedNodes])}` 교체 (R3.1, R3.2)
- 사용자 지정 제목은 패턴 불일치로 자동 무시 (R3.3)
- **근거 요구사항**: R3.1~R3.3

## 4. 데이터 모델
- 변경 없음. DB·shared DTO·소켓 이벤트 무변경. 새 노드 생성 emit 경로(`node:add`)와 undo/redo recorder(직전 기능)도 무변경 — 제목 문자열 계산만 바뀐다.

## 5. 에러 처리
- `ResizeObserver` 미지원 브라우저(사실상 없음): 최초 1회 측정으로 폴백 — 잘림 표시가 늦게 갱신될 뿐 기능은 동작.
- 제목이 "새 노드 999999" 같은 극단값: 그대로 +1 — 오버플로 현실성 없음, 방어 코드 불필요.
- 휴지통 조회 실패로 `trashedNodes`가 비어 있는 경우: 화면 노드 기준으로만 계산 — 최악의 경우 휴지통 노드와 번호가 겹칠 수 있으나 기존 동작보다 나쁘지 않음.

## 6. 테스트 전략
- **단위 (vitest, 기존 셋업 재사용)**: `nextDefaultNodeNumber` 경유 `applyLocalAddNode` 동작 — 빈 캔버스→1, 연속 생성 증가, 중간 삭제(휴지통 이동) 후 생성 시 중복 없음, 휴지통 번호 승계, 사용자 지정 제목 무시.
- **수동 QA**: OS 다크모드에서 펼침 배경 흰색 확인, 긴 본문 잘림 표시·짧은 본문 미표시, 표/긴 코드 가로 스크롤, 더블클릭 진입 유지.
- **회귀**: `./scripts/check` + 기존 web 테스트 22개(특히 recorder 테스트의 노드 생성 경로).

## 7. 결정 기록
- ADR 없음 — 번복 비용이 큰 구조 결정 없음(전부 국소 UI/계산 변경, 번호 계산 방식은 requirements 승인에 포함됨).
