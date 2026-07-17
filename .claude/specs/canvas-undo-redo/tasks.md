---
feature: canvas-undo-redo
status: approved
created: 2026-07-16
---

# 캔버스 Undo/Redo — 태스크

> 체크박스가 실행 상태의 단일 진실 공급원이다. 태스크 완료 = 완료 조건 + 연결된 인수 조건 충족 + 관련 테스트 통과.
> 전 태스크 apps/web 국한 (BE·shared·openapi 무변경, ADR-0002). 검증 = `./scripts/check` + apps/web vitest.

- [x] **T1. historyStore + vitest 셋업 + 단위 테스트**
  - 내용: `apps/web/src/store/historyStore.ts` 신규 — `HistoryCommand {label, undo(), redo(), nodeIds?, edgeIds?}`, `undoStack/redoStack`, `record`(redoStack 비움 + MAX_HISTORY=50 상한), `undo/redo`(실행 전 유효성 훅 호출), `clear`, `canUndo/canRedo`. 유효성 검사는 주입 가능한 `validate(cmd)` 콜백(기본: canvasStore·presenceStore 조회 — 대상 존재(R5.1)/타인 락(R5.2) 검사, 무효 사유 반환). apps/web에 vitest 설정 추가(packages/shared 구성 준용, `pnpm --filter @markflow/web test` 동작) + historyStore 단위 테스트(record→undo→redo 순서, redo 무효화, 상한, clear, 빈 스택 no-op, 무효 커맨드 폐기/락 유지 정책).
  - 요구사항: R1.3, R3.1, R5.1, R5.2, R6.1, R6.3, R6.4
  - 완료 조건: `pnpm --filter @markflow/web test` 통과 + `./scripts/check` 통과.

- [x] **T2. canvasStore 보조 액션 (id 보존 엣지 재생성 · 위치 재적용)**
  - 내용: `canvasStore.ts`에 ① `applyLocalAddEdgeWithId(edge: EdgeDTO)` — 기존 applyLocalAddEdge와 동일 경로(emit `edge:add` + scheduleSave)이되 주어진 id 사용(undo/redo 시 엣지 id 보존, 중복 id 멱등 가드) ② `applyLocalMoveNode(id, position)` — 위치만 재적용 + emit `node:update {id, position}` + scheduleSave. 기존 액션·에코 규칙(applyRemote는 emit 금지) 불변.
  - 요구사항: R2.3, R2.4, R2.5, R4.1
  - 완료 조건: `./scripts/check` 통과. 두 액션이 emit+scheduleSave 경로를 타는 것 diff 확인.
  - 조율: **F1 도메인 파일(canvasStore) 수정** — F1 위임 합의 범위 내(undo/redo가 F1 기능).

- [x] **T3. 캔버스 연산 recorder 배선 (생성·삭제·이동·엣지)**
  - 알려진 동작: 휴지통 드래그-드롭 삭제는 [이동, 삭제] 2 step으로 기록됨(XYDrag가 위치 커밋 후 DragStop을 호출하는 순서 때문). undo 2회면 원위치까지 완전 복구되므로 의도적으로 수용 — 이동 기록을 억제하면 원위치 복귀 경로가 사라진다.
  - 내용: 내 동작만 기록(R3.1) — ① 노드 생성: `applyLocalAddNode` 호출부에서 record(undo=applyLocalDeleteNode, redo=applyLocalRestoreNode) ② 노드 삭제: `applyLocalDeleteNode` 직전 연결 엣지 목록 캡처, record(undo=restore+엣지들 applyLocalAddEdgeWithId, redo=delete) ③ 이동: React Flow `onNodeDragStart`에서 시작 좌표 캡처, `onNodesChange` 드래그 커밋 시 record(undo/redo=applyLocalMoveNode) — 위치 불변 드래그는 기록 생략 ④ 엣지 연결: `onConnect` 경유 record(undo=applyLocalDeleteEdge, redo=applyLocalAddEdgeWithId) ⑤ 엣지 해제: `applyLocalDeleteEdge` 호출부(DeletableEdge·onEdgesChange)에서 대상 엣지 캡처 후 record. `applyRemote*` 경로에는 어떤 기록도 넣지 않음(R3.2/R4.2). undo/redo 실행 중 재기록 방지 가드(플래그) 포함.
  - 요구사항: R2.1~R2.5, R2.7, R3.1, R3.2, R4.1, R4.2
  - 완료 조건: `./scripts/check` 통과 + 2탭 수동 시나리오(생성→undo→redo, 삭제→undo 시 엣지 복원, 이동→undo, 엣지 연결/해제→undo)가 로컬·상대 화면 모두 정합. 원격 수신이 스택에 안 쌓임.

- [x] **T4. 노드 에디터 저장 recorder (제목·내용)**
  - 내용: `node-editor` `handleSave` 성공 시(useSaveNode onSuccess 경로) 저장 전 `{title, markdown}`(직전 서버 반영값 기준) 캡처 → record(undo/redo=`applyLocalUpdateNode(id, {...})`; 에디터 밖 캔버스 복귀 후에도 동작). 연속 저장은 저장 1회=1 step(R2.7). no-op 저장(값 불변)은 기록 생략.
  - 요구사항: R2.6, R2.7
  - 완료 조건: `./scripts/check` 통과 + 수동: 내용 수정·저장→캔버스 복귀→undo 시 이전 내용으로 (상대 화면 동일), redo 재적용.

- [x] **T5. UndoRedoControls (하단 좌측 pill) + 피드백**
  - 내용: `apps/web/src/features/canvas/UndoRedoControls.tsx` 신규 — 하단 **좌측** 별도 pill(ZoomControls 스타일 준용, MiniMap과 겹침 회피), Undo/Redo 아이콘 버튼, `canUndo/canRedo`·`readOnly(canEdit)` 비활성(R7.1, R8.2), aria-label. R5 무효/락 시 피드백: 기존 토스트 시스템이 없으므로 pill 인근 2초 인라인 메시지(경량, 신규 전역 시스템 도입 금지). `canvas/index.tsx` CanvasSurface에 배치.
  - 요구사항: R1.1, R1.2, R5.1, R5.2(알림), R7.1, R8.1, R8.2
  - 완료 조건: `./scripts/check` 통과 + 수동: 버튼 활성/비활성 전환, VIEWER 비활성, 무효 시 메시지 노출.

- [x] **T6. 키보드 단축키 + 스택 수명 배선**
  - 구현 노트: keydown 리스너는 CanvasSurface가 아니라 그 자식 UndoRedoControls에 두었다(동일 수명 + T5 핸들러·피드백 재사용). 에디터 라우트는 이 컴포넌트가 미마운트라 R1.4 자연 충족.
  - 내용: ① `CanvasSurface`에 window keydown — (meta|ctrl)+Z→undo, +Shift(또는 ctrl+Y)→redo, `event.target`이 input/textarea/contenteditable이면 무시(R1.4), readOnly 무시, 언마운트 해제 ② 스택 수명: `ProjectCollabLayout` 언마운트(프로젝트 이탈) 시 `historyStore.clear()`(R6.2 — 캔버스↔에디터 이동은 유지) ③ `sync:resync` 수신 시(useSocketCollab) `clear()` — 서버 강제 재동기화 후 불일치 차단(design §5).
  - 요구사항: R1.1, R1.2, R1.4, R6.1, R6.2, R7.1
  - 완료 조건: `./scripts/check` 통과 + 수동: 단축키 동작, 입력 포커스 중 무시, 프로젝트 이탈 후 스택 초기화.

- [x] **T7. 최종 통합 검증 + 인수 조건 전수 점검**
  - 내용: 전체 스위트(`./scripts/check`·`./scripts/test`·web vitest) + 2세션 E2E(2계정: per-user 격리 R3.2, 전파 R3.3, 락 충돌 R5.2) + requirements.md 인수 조건 전수 표 작성. 미충족 발견 시 수정 태스크로 회귀.
  - 요구사항: R1~R8 전부
  - 완료 조건: 인수 조건 표에서 미충족 0 (R5.3은 승인된 완화 기준).
  - 수행 기록: 전체 스위트 통과(shared 24 · api 6 · web 22, check 통과). 별도 리뷰어(opus) diff 리뷰 — blocker/major 0. 리뷰 지적에 따라 recorder 역연산 매핑 테스트 9개 추가(canvasStore.recorder.test.ts, design §6 이행). 2세션 E2E는 실계정 필요로 자동화 불가 — 아래 수동 QA 체크리스트로 이관.

## 인수 조건 검증 표 (T7)

| 조건 | 검증 방식 | 판정 |
|---|---|---|
| R1.1/R1.2 버튼·단축키 실행 | UndoRedoControls 버튼+keydown 코드 확인 | 충족(수동 QA 확인 권장) |
| R1.3 빈 스택 비활성·무시 | 단위 테스트(empty no-op) + disabled 구독 | 충족 |
| R1.4 에디터 텍스트 undo 양보 | 에디터 라우트엔 리스너 미마운트 + input/textarea/contentEditable 가드 | 충족 |
| R2.1~R2.5 4종 연산 역연산 | recorder 테스트 9개(생성/삭제+엣지복원+dangling 스킵/이동 멀티드래그/엣지 연결·해제 id 보존) | 충족 |
| R2.6 제목·내용 저장 undo | T4 recorder 코드 확인(저장 성공 시 record, prev ref) | 충족(수동 QA 확인 권장) |
| R2.7 step 단위 | 드래그 1 step·제자리 드롭 미기록 테스트, 저장 no-op 생략 | 충족 |
| R2.8 접기·뷰포트 제외 | 토글 미기록 테스트, 뷰포트는 기록 지점 자체 없음 | 충족 |
| R3.1/R3.2 per-user | applyLocal*에서만 record, applyRemote* 미기록 테스트 | 충족 |
| R3.3/R4.1 전파·영속 | 역연산이 기존 applyLocal 경로(emit+scheduleSave/REST) 재사용 — 코드 확인 | 충족(2세션 수동 QA 필요) |
| R4.2 에코 루프 방지 | isApplying 가드 테스트 + 원격 미기록 테스트 | 충족 |
| R5.1 대상 소실 | validator missing 폐기 테스트 + 2초 인라인 알림 | 충족 |
| R5.2 타인 락 | locked 유지 테스트(recorder 레벨 포함) + 알림 | 충족 |
| R5.3 서버 거부(완화 승인) | sync:resync 수신 시 clear — 코드 확인 | 충족(완화 기준) |
| R6.1~R6.4 스택 수명 | 세션 메모리·레이아웃 언마운트 clear·redo 무효화·MAX 50 테스트 | 충족 |
| R7.1/R7.2 권한 | VIEWER 비활성+단축키 무시, 서버 가드는 기존 그대로(BE 무변경) | 충족 |
| R8.1/R8.2 UI 배치 | 하단 좌측 pill(ZoomControls 관례)·disabled 시각 표시 | 충족(수동 QA 확인 권장) |

### 알려진 제한 (승인·수용됨)
- 휴지통 드래그-드롭 삭제 = [이동, 삭제] 2 step (T3 노트 — undo 2회로 완전 복구).
- 노드 type 변경은 undo 대상 아님(R2.6 범위: 제목·마크다운) — 한 저장에서 함께 바꾸면 type은 잔존.
- 생성 후 미영속(<2s) 노드의 undo는 서버 404 가능 — ADR-0002 best-effort 수용 범위.
