---
feature: node-card-preview-and-count
status: approved
created: 2026-07-17
---

# 노드 카드 md 미리보기 개선 + 생성 번호 고유화 — 태스크

> 체크박스가 실행 상태의 단일 진실 공급원. 전 태스크 apps/web 국한(BE·shared·openapi 무변경). 검증 = `./scripts/check` + web vitest.

- [x] **T1. 새 노드 기본 이름 번호 고유화 + 단위 테스트**
  - 내용: `store/canvasStore.ts`에 모듈 헬퍼 `nextDefaultNodeNumber`(정규식 `/^새 노드 (\d+)$/`, nodes ∪ trashedNodes 최대 번호+1, 없으면 1) 추가, `applyLocalAddNode`의 `새 노드 ${nodes.length + 1}` 교체. 단위 테스트(`store/canvasStore.naming.test.ts` 신규): 빈 캔버스→1, 연속 생성 증가, 중간 삭제(휴지통 이동) 후 생성 시 중복 없음, 휴지통 최대 번호 승계, 사용자 지정 제목 무시.
  - 요구사항: R3.1, R3.2, R3.3
  - 완료 조건: 신규 테스트 + 기존 web 테스트 22개 통과, `./scripts/check` 통과.

- [ ] **T2. 펼친 카드 렌더 개선 (라이트 테마 + 높이 상한 + 잘림 표시 + 가로 가드)**
  - 내용: `features/canvas/MarkdownNodeCard.tsx` 펼침 분기 — ① 래퍼에 `data-color-mode="light"`(R1.1) ② `relative max-h-[240px] overflow-hidden`(R2.1) ③ ref+ResizeObserver로 `scrollHeight > clientHeight` 측정 → `isClamped`일 때만 하단 페이드+`⋯` 렌더(R2.1/R2.2), 언마운트·접힘 시 observer 정리 ④ 가로 가드 `[&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_img]:max-w-full`(R2.4). 더블클릭 진입 무변경(R2.3).
  - 요구사항: R1.1, R1.2, R2.1~R2.4
  - 완료 조건: `./scripts/check` + 기존 테스트 회귀 통과. 수동: 다크모드 OS에서 흰 배경, 긴 본문 잘림 표시·짧은 본문 미표시, 표/코드 가로 스크롤.

- [ ] **T3. 최종 검증 + 인수 조건 전수 점검**
  - 내용: 전체 스위트(`./scripts/check`·`./scripts/test`) + requirements.md 인수 조건 표 작성. 수동 QA(다크모드 배경·잘림·가로·더블클릭·번호 중복)는 체크리스트로 사용자 확인 요청. 미충족 발견 시 수정 후 재검증.
  - 요구사항: R1~R3 전부
  - 완료 조건: 인수 조건 표 미충족 0.
