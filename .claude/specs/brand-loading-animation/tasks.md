---
feature: brand-loading-animation
status: approved
created: 2026-07-20
---

# 브랜드 로딩 애니메이션 — 태스크

> 체크박스가 실행 상태의 단일 진실 공급원이다. 태스크 완료 = 완료 조건 + 연결된 인수 조건 충족 + 관련 테스트 통과.

- [x] **T1. BrandLoader 컴포넌트 + 애니메이션 CSS**
  - 내용: `apps/web/src/components/BrandLoader.tsx` 신규(타일 없는 M 노드 그래프 SVG, `size`/`className` props, `role="status"` + sr-only 텍스트) + `index.css`에 `mf-loader-*` 키프레임·클래스(드로잉/노드 점등/유지/페이드 사이클, reduced-motion 정적 폴백) + 배럴 export 추가
  - 요구사항: R1.1–R1.6
  - 완료 조건: 임시 렌더로 헤드리스 크롬 스크린샷 캡처 — 사이클 진행 프레임과 완성 프레임 확인, reduced-motion에서 정적 M 확인. `./scripts/check` 통과

- [x] **T2. 부팅 로딩 교체**
  - 내용: `routes/index.tsx`의 `BootLoading`에서 "불러오는 중…" 텍스트 제거, `<BrandLoader />` 렌더로 교체 (컨테이너 중앙 정렬 유지, 중복 `role="status"` 정리)
  - 요구사항: R2.1, R2.2
  - 완료 조건: 새로고침 시 M 애니메이션 표시, 복원 완료 후 라우팅 기존과 동일(인증→원래 화면, 미인증→/login). `./scripts/check` 통과

- [x] **T3. 캔버스 로딩 오버레이**
  - 내용: `features/canvas/index.tsx`에서 `canvasStore.isLoading` 구독, true 동안 surface 컨테이너에 `absolute inset-0` 반투명 오버레이 + 중앙 `<BrandLoader />` 렌더
  - 요구사항: R3.1–R3.3
  - 완료 조건: 캔버스 진입 시 오버레이 표시·로드 완료 시 제거, 오버레이 표시 중 노드 클릭/드래그 불가 확인. `./scripts/check` 통과

- [x] **T4. 통합 검증 + 인수 조건 전수 점검**
  - 내용: dev 서버로 부팅/캔버스 두 시나리오 실제 확인(스크린샷), requirements의 R1~R3 전 인수 조건 충족 여부 표로 정리
  - 요구사항: 전체
  - 완료 조건: 전 인수 조건 충족, `./scripts/check` + `./scripts/test` 통과

- [x] **T5. 로딩 스플래시 통일 (2026-07-20 추가)**
  - 내용: LoadingSplash 컴포넌트 추출(fixed 뷰포트 정중앙, 불투명 bg-app) — 부팅·캔버스 양쪽 적용, 캔버스는 영역 오버레이 → 풀스크린 전환
  - 요구사항: R3.1(변경분), R2.1
  - 완료 조건: 두 로딩 모두 뷰포트 정중앙 표시, `./scripts/check` 통과

- [x] **T6. 브랜드 마크 통일 (2026-07-20 추가)**
  - 내용: BrandMark 정적 컴포넌트 신규 → GlobalHeader 로고 교체. 파비콘(feat/web-favicon 브랜치)을 타일 없는 동일 도형으로 갱신 + PNG 재생성
  - 요구사항: R4.1, R4.2
  - 완료 조건: 헤더에 M 마크 렌더 확인, 파비콘 자산 3종 갱신·PR #82 반영, `./scripts/check` 통과
