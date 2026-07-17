---
feature: canvas-undo-redo
status: approved
created: 2026-07-15
---

# 캔버스 Undo/Redo — 기술 설계

## 1. 아키텍처 개요

**한 줄 요약**: "내가 한 편집"을 되돌리기/다시하기 명령(Command) 한 쌍으로 만들어 로컬 스택에 쌓고, 되돌릴 때는 그 **역연산을 기존 편집 경로로 다시 실행**한다. 서버·다른 참가자에게도 일반 편집과 똑같이 반영된다. (전체 근거 → ADR-0002)

핵심 부품:
- **`historyStore`** (신규 Zustand) — `undoStack`·`redoStack`에 Command를 보관하고 `record/undo/redo/clear`를 제공. 세션 메모리(R6.1).
- **Command** — `{ label, undo(), redo(), 대상 id들 }`. `undo()`/`redo()`는 캔버스의 기존 `applyLocal*`(emit 포함) 액션을 호출한다 → 전파·저장 자동(R3.3, R4.1).
- **기록 지점(recorder)** — 6종 연산이 일어나는 곳에서, 실행 직후(또는 감싸서) "이전 값"을 캡처해 `historyStore.record(cmd)`. 원격 수신(`applyRemote*`)에서는 기록하지 않음 → per-user + 에코 방지(R3.1, R3.2, R4.2).
- **`UndoRedoControls`** (신규 컴포넌트) — 캔버스 하단 도구모음의 버튼(R8). `canUndo/canRedo`·역할로 활성/비활성.
- **키보드 훅** — `CanvasSurface`에 `keydown` 리스너 추가(Ctrl/Cmd+Z, +Shift). 노드 에디터는 별도 라우트라 캔버스 리스너가 안 뜸 → 텍스트 undo와 자연 분리(R1.4).

흐름(노드 이동 예):
```
사용자 드래그 종료
  → onNodesChange(위치 반영 + emit node:update + scheduleSave)   ← 기존 그대로
  → recorder: record({ undo: 이전좌표로, redo: 새좌표로 })         ← 신규
...
Undo 클릭/Ctrl+Z
  → historyStore.undo(): 대상 유효성 검사 → cmd.undo() 실행
       = applyLocal(위치=이전좌표) → emit node:update + PUT 저장    ← 기존 경로 재사용
  → 그 커맨드를 redoStack으로 이동
```

이 설계가 충족하는 요구사항: R1~R8 전부. 상세 매핑은 §3·§5.

## 2. 기술 선택과 이유

| 기술/패턴 | 역할 (한 줄 풀이) | 왜 이것인가 (대안 대비) |
|---|---|---|
| Command 패턴 | 각 편집을 "되돌리기/다시하기 방법을 아는 객체"로 표현 | 되돌리기 로직을 연산별로 캡슐화 → 스택은 그냥 실행만. 상태 스냅샷 전체를 쌓는 방식보다 메모리·정확도 유리 |
| 클라이언트 세션 스택 (Zustand) | 되돌리기 기록을 브라우저 메모리에 보관 | 서버 DB·API 없이 완성(ADR-0002 대안1). 기존 store 패턴과 동일 |
| 기존 `applyLocal*` 재사용 | 되돌리기를 "일반 편집"으로 다시 실행 | undo 결과가 자동으로 소켓 전파 + 서버 저장 + 히스토리 기록됨. 별도 동기화 배관 불필요 |
| 삭제=soft delete + `restore` | 노드 삭제 되돌리기 | 이미 구현됨(POST `/nodes/:id/restore`, **원좌표 그대로 복원**) → 노드 삭제 undo는 거의 무료(R2.2) |

**번복 비용이 큰 결정** → ADR-0002 (§7).

## 3. 컴포넌트와 인터페이스

### historyStore (신규: `apps/web/src/store/historyStore.ts`)
- **책임**: undo/redo 스택 관리, 유효성 검사 후 커맨드 실행.
- **인터페이스**:
  ```ts
  interface HistoryCommand {
    label: string;                 // 접근성/디버깅용 ("노드 이동" 등)
    undo: () => void;              // 역연산 — applyLocal* 호출(emit 포함)
    redo: () => void;              // 재연산 — 원 동작 재적용(applyLocal* 호출)
    nodeIds?: string[];            // 유효성 검사 대상
    edgeIds?: string[];
  }
  interface HistoryState {
    undoStack: HistoryCommand[];
    redoStack: HistoryCommand[];
    record(cmd: HistoryCommand): void;   // undoStack push + redoStack 비움(R6.3)
    undo(): void;                        // 유효성 검사 → cmd.undo() → redoStack push
    redo(): void;
    clear(): void;                       // R6.2
    canUndo(): boolean; canRedo(): boolean;
  }
  ```
- `record`는 undoStack 상한 `MAX_HISTORY = 50`(R6.4) 초과 시 오래된 것부터 버린다.
- **근거 요구사항**: R1.1~R1.3, R3.1, R6.1~R6.4.

### recorders — 6종 연산 기록 (캔버스 store/컴포넌트 내 지점)
각 연산의 역연산 매핑(§ 탐색 결과 기반):

| 연산 | 기록 지점 | undo() | redo() | 캡처할 이전 값 |
|---|---|---|---|---|
| 노드 생성 (R2.1) | `applyLocalAddNode` 반환 후 | `applyLocalDeleteNode(id)` | `applyLocalRestoreNode(id)` | (id만) |
| 노드 삭제 (R2.2) | `applyLocalDeleteNode` 직전 | `applyLocalRestoreNode(id)` **+ 연결 엣지 재생성** | `applyLocalDeleteNode(id)` | 삭제 노드에 연결된 엣지 목록 |
| 노드 이동 (R2.3) | 드래그 종료(`onNodeDragStart`에서 시작좌표 캡처) | 위치=이전좌표 재적용(emit) | 위치=새좌표 재적용 | 드래그 시작 좌표 |
| 엣지 연결 (R2.4) | `applyLocalAddEdge` 후 | `applyLocalDeleteEdge(id)` | 같은 id로 재연결 | edge {id,source,target} |
| 엣지 해제 (R2.5) | `applyLocalDeleteEdge` 직전 | 같은 id로 재연결 | `applyLocalDeleteEdge(id)` | edge {id,source,target} |
| 제목·내용 (R2.6) | 노드 에디터 `handleSave` | `applyLocalUpdateNode(id, 이전값)` | `applyLocalUpdateNode(id, 새값)` | 저장 전 {title, markdown} |

- **신규 store 액션 1개**: `applyLocalAddEdgeWithId(edge: EdgeDTO)` — 기존 `applyLocalAddEdge`는 매번 새 id를 발급해서, 엣지 해제/노드삭제 undo 시 **원래 edge id를 보존**하려면 id를 받는 변형이 필요(emit·저장 경로는 동일). 없으면 redo 체인에서 id 불일치.
- 노드 이동 되돌리기는 위치 patch를 `applyLocalUpdateNode(id, {}, position)` 형태(emit 포함)로 재적용 — 탐색 결과 `applyRemoteUpdateNode`가 position 인자를 받으므로 대응 로컬 경로를 맞춘다(필요 시 얇은 헬퍼 추가).
- **근거 요구사항**: R2.1~R2.7.

### UndoRedoControls (신규: `apps/web/src/features/canvas/UndoRedoControls.tsx`)
- **책임**: 하단 도구모음에 Undo·Redo 버튼(아이콘) 렌더, `historyStore` 구독.
- **배치**: `ZoomControls`(하단 우측 pill) **내부에 인라인** — [↶ ↷ | 줌% − + ⊙] 구성(2026-07-17 사용자 요청으로 별도 좌하단 pill에서 이동). 키보드 리스너도 이 컴포넌트에 있어 캔버스 화면 동안 상시 마운트.
- **상태**: `disabled = !canUndo() (또는 !canRedo()) || readOnly`. `readOnly = role!==null && !canEdit(role)`(기존 패턴, R7.1).
- **근거 요구사항**: R7.1, R8.1, R8.2.

### 키보드 단축키 (CanvasSurface useEffect, `canvas/index.tsx`)
- `keydown` 리스너: (meta||ctrl)+z & !shift → `historyStore.undo()`; +shift 또는 ctrl+y → `redo()`.
- 가드: `event.target`이 input/textarea/contenteditable이면 무시(R1.4 보강). readOnly면 무시(R7.1).
- 기존 window 리스너(pointermove) 옆에 추가, 언마운트 정리.
- **근거 요구사항**: R1.1, R1.2, R1.4, R7.1.

## 4. 데이터 모델
- **DB/스키마/마이그레이션 변경 없음.** 세션 메모리만(R6.1). `packages/shared`·openapi 변경 없음.
- 신규 타입: `HistoryCommand`, `HistoryState`(위). 기존 `EdgeDTO`/`NodeDTO`(@markflow/shared) 재사용.
- `historyStore`는 `projectId` 스코프. `ProjectCollabLayout` 언마운트 시(=프로젝트 이탈) `clear()` 호출(R6.2). 캔버스↔노드에디터 라우트 이동은 레이아웃 유지라 스택 보존.

## 5. 에러 처리 (요구사항 IF/THEN 대응)
- **대상 소실 (R5.1)**: `undo()`/`redo()` 실행 전 `nodeIds`/`edgeIds`가 현재 `canvasStore`(nodes 또는 trashedNodes)에 유효한지 검사. 무효면 커맨드를 실행하지 않고 스택에서 폐기 + 토스트("되돌릴 대상이 이미 변경되었습니다"). 다음 커맨드로 자동 진행하지 않음(사용자가 다시 누름).
- **소프트락 (R5.2)**: 대상 노드가 `isLockedByOther(nodeId)`면 실행 거부 + 토스트("다른 사용자가 편집 중"). 커맨드는 스택에 유지(락 풀리면 재시도 가능).
- **서버 거부 (R5.3)** — **제약 있음**: 현재 REST는 fire-and-forget이고 클라이언트 롤백/재동기화 요청 경로가 없다(탐색 결과 §9). 따라서 MVP는 **클라이언트 유효성 검사까지만** 방어하고, 서버가 조용히 거부한 경우의 완전 롤백은 지원하지 않는다. 서버가 `sync:resync`로 강제 재동기화하면 `historyStore.clear()`로 스택을 무효화해 실제 상태와의 불일치를 끊는다. → **이 제약은 승인 게이트에서 사용자 확인 필요**(요구사항 R5.3 완화).
- **미연결/뷰어**: `activeCollab`이 null이면 emit이 no-op(기존). VIEWER는 소켓 미연결·버튼 비활성(R7).

## 6. 테스트 전략
- **단위 (vitest)**: `historyStore` 순수 로직 — record→undo→redo 순서, redo 무효화(R6.3), 스택 상한(R6.4), clear(R6.2), 빈 스택 가드(R1.3). 각 연산의 역연산 매핑을 목(mock) `applyLocal*`로 호출 검증. (현재 apps/web에 테스트 러너 없음 → vitest 설정 추가가 첫 태스크에 포함.)
- **통합/수동(QA)**: 2세션(2계정)으로 — 내가 undo 시 상대 화면·서버 반영 확인(R3.3/R4.1), 상대 동작이 내 스택에 안 쌓임(R3.2), 대상 소실/락 시 스킵(R5.1/R5.2), VIEWER 비활성(R7.1), 단축키 vs 에디터 텍스트 undo 분리(R1.4).
- **회귀**: `./scripts/check`(typecheck+build) 통과.

## 7. 결정 기록
- ADR-0002: 캔버스 Undo/Redo 아키텍처 — 클라이언트 per-user 커맨드 스택 (`.claude/specs/adr/0002-canvas-undo-redo-architecture.md`)
