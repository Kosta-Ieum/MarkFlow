---
feature: brand-loading-animation
status: approved
created: 2026-07-20
---

# 브랜드 로딩 애니메이션 — 기술 설계

## 1. 아키텍처 개요

새 표시 전용 컴포넌트 `BrandLoader` 하나를 만들고, 두 사용처가 각자 감싸서 쓴다.

```
components/BrandLoader.tsx   ← M 노드 그래프 SVG + 애니메이션 + 접근성 텍스트 (R1)
      │
      ├── routes/index.tsx BootLoading         ← 기존 텍스트를 BrandLoader로 교체 (R2)
      └── features/canvas/index.tsx 오버레이    ← isLoading 동안 absolute 오버레이로 표시 (R3)
```

- 애니메이션은 순수 CSS(`index.css`)로 구현 — 상태·로직 없음, 렌더만 한다.
- 데이터 흐름 변경 없음: `authStore.isBootstrapping`·`canvasStore.isLoading`은 이미 존재하는 상태를 그대로 구독한다(Zustand 단일 진실원 규칙 유지).

## 2. 기술 선택과 이유

| 기술/패턴 | 역할 (한 줄 풀이) | 왜 이것인가 (대안 대비) |
|---|---|---|
| SVG `stroke-dasharray` 드로잉 | 선을 "그려지는 중"처럼 보이게 하는 표준 기법. 선을 점선으로 만들고 점선의 시작 위치를 밀어서 조금씩 드러낸다 | 엣지가 순서대로 그려지는 효과(R1.2)를 GIF·JS 없이 CSS만으로 구현. `pathLength="100"`으로 좌표 계산 없이 %로 제어 |
| CSS `@keyframes` (index.css) | 애니메이션 타임라인 정의 | 라이브러리(framer-motion 등) 추가 없이 구현(Non-goal 준수). 모든 요소가 같은 duration의 한 타임라인을 공유해 반복 시에도 어긋나지 않음 |
| `index.css` @layer components에 배치 | 이 애니메이션 전용 CSS 클래스 | tailwind.config의 `mf*` 키프레임은 여러 곳에서 재사용하는 범용 유틸리티. 이건 단일 용도 복합 애니메이션(키프레임 6개)이라 유틸리티로 노출할 이유가 없어 CSS로 분리 |
| `prefers-reduced-motion` 미디어 쿼리 | OS "모션 줄이기" 사용자에게 애니메이션 제거 | 기본 스타일 자체를 "완성된 M"으로 두고 애니메이션이 덮어쓰는 구조 → 쿼리에서 `animation: none`만 하면 자동으로 정적 아이콘(R1.4) |
| 표시 전용 컴포넌트 (props: `size`, `className`) | 사용처가 배치만 결정 | 부팅(전체 화면 중앙)과 캔버스(오버레이)의 레이아웃 요구가 달라 배치 책임을 사용처에 둠 |

디자인 결정 하나: 파비콘의 초록 타일(배경 사각형)은 **빼고**, M 도형만 브랜드 그린으로 그린다. 로딩 인디케이터로는 도형만 있는 쪽이 배경과 자연스럽게 어울리고, 타일까지 넣으면 "앱 아이콘이 떠 있는" 느낌이 강해진다. (취향 문제라 반대면 타일 추가는 rect 하나로 끝나는 수정)

## 3. 컴포넌트와 인터페이스

### BrandLoader (`apps/web/src/components/BrandLoader.tsx`, 배럴 export 추가)
- **책임**: M 노드 그래프 SVG 렌더 + 애니메이션 클래스 부착 + 스크린리더 텍스트. 그 외 아무것도 안 함.
- **인터페이스**: `({ size = 64, className }: { size?: number; className?: string })`
  - 루트: `<div role="status" aria-live="polite">` — 내부에 `<span class="sr-only">불러오는 중</span>` (R1.5)
  - SVG: viewBox 32×32 (파비콘과 동일 좌표), path 1개(엣지 4개 연결) + circle 5개 (R1.1)
- **애니메이션 타임라인** (한 사이클 2.2s, infinite — R1.2, R1.3):
  - 0→60%: path가 `stroke-dashoffset` 100→0으로 그려짐 (좌하 노드에서 시작해 M 획 순서대로)
  - 노드 점등: path가 각 노드를 지나는 시점에 opacity+scale 팝 — 사이클의 0% / 16% / 30% / 44% / 60% (경로 누적 길이 비율로 계산)
  - 60→88%: 완성 상태 유지 (R1.3)
  - 88→100%: 전체 페이드아웃 → 다음 사이클
  - 노드별 점등 시점이 달라 keyframes를 노드당 1개씩 분리(총 6개, `mf-loader-*` 네이밍). `animation-delay` 방식은 반복 시 페이드아웃 타이밍이 어긋나므로 사용하지 않음.
- **근거 요구사항**: R1.1–R1.6

### BootLoading (`apps/web/src/routes/index.tsx` 수정)
- **책임**: 기존 컨테이너(`min-h-[60vh]` 중앙 정렬) 유지, 내부 텍스트를 `<BrandLoader />`로 교체. `role="status"`는 BrandLoader가 갖게 되므로 컨테이너에서 제거 (R2.1, R2.2 — 라우팅 로직 무변경)

### 캔버스 로딩 오버레이 (`apps/web/src/features/canvas/index.tsx` 수정)
- **책임**: `useCanvasStore((s) => s.isLoading)` 구독, true면 캔버스 surface 컨테이너 안에 `absolute inset-0` 오버레이 렌더 (R3.1)
  - 오버레이: 반투명 배경(`bg-app/70`) + 중앙 `<BrandLoader />`, ReactFlow보다 위 z-index
  - div가 포인터 이벤트를 그대로 받으므로 아래 캔버스 조작이 자연 차단됨 (R3.3)
  - `isLoading` false → 렌더 자체가 사라짐, 잔여 DOM 없음 (R3.2)
- **근거 요구사항**: R3.1–R3.3

## 4. 데이터 모델

없음. 스토어·DTO·스키마 변경 없음 (기존 상태 구독만).

## 5. 에러 처리

- 로딩이 영원히 안 끝나는 경우(네트워크 등)의 타임아웃 처리는 기존 각 스토어의 에러 흐름 소관 — 이 기능은 표시만 담당하므로 새 에러 경로 없음.
- R1.4(모션 최소화)는 CSS 미디어 쿼리로 처리 — JS 분기 없음.

## 6. 테스트 전략

- 로직이 없는 표시 전용 컴포넌트 — DOM 렌더 테스트를 위해 jsdom·testing-library를 **새로 추가하지 않는다** (새 의존성 금지 원칙, 얻는 것 대비 과함).
- 검증 방법:
  - `./scripts/check` (typecheck·build 게이트)
  - 브라우저 수동 확인: 새로고침 부팅 로딩(R2), 캔버스 진입 오버레이(R3), 헤드리스 크롬 스크린샷으로 프레임 확인
  - DevTools 에뮬레이션으로 `prefers-reduced-motion: reduce` 확인 (R1.4)

## 7. 결정 기록

ADR 없음 — 표시 전용 UI로 번복 비용이 낮고, 실질적 대안 간 트레이드오프가 크지 않음.
