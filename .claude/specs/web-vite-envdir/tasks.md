# web-vite-envdir — 태스크

> 이슈: 로컬 dev에서 프론트가 루트 `.env`의 `VITE_*`를 못 읽음 (팀 보고 2026-07-10).
> 원인: env 템플릿은 레포 루트 `.env.example` 하나뿐(bootstrap이 루트 `.env` 생성)인데,
> `apps/web/vite.config.ts`에 `envDir`가 없어 Vite 기본값(`apps/web/`)만 탐색 →
> `VITE_API_BASE`·`VITE_WS_URL`·`VITE_MOCK_API` 전부 undefined, localhost:4000 폴백.
> 배포(Docker)는 build ARG→process.env 주입이라 영향 없음 — 로컬 dev 전용 버그.

- [x] 1. `apps/web/vite.config.ts`에 `envDir`를 레포 루트로 지정
  - 범위: `apps/web/vite.config.ts` 단일 파일. (다른 파일·계약 불변)
  - 완료 기준:
    - `pnpm --filter @markflow/web typecheck` + `./scripts/check` 통과
    - dev 서버 기동 시 루트 `.env`의 `VITE_*`가 `import.meta.env`에 반영됨 (dev 서버 관찰로 확인 — `.env` 파일 자체는 읽지 않음)
    - Docker 빌드 경로(process.env 주입) 영향 없음 확인
  - 브랜치: `fix/web-vite-envdir` (origin/main 기반, devtools 툴링 변경과 분리)
