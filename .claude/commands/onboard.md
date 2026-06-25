---
description: 팀원 역할별 온보딩 — 로컬 스코프 가드 적용 + 문서·규칙·첫 작업을 컨텍스트로 주입
argument-hint: <BE|F1|F2>
allowed-tools: Bash(./scripts/set-role.sh:*), Read, Glob
---

역할 **$1** 로 온보딩을 진행한다. 아래를 순서대로 수행하라.

1. **역할 검증** — `$1` 이 `BE` / `F1` / `F2` 중 하나가 아니면, 사용법(`/onboard <BE|F1|F2>`)만 안내하고 중단한다.

2. **로컬 스코프 가드 적용** — `./scripts/set-role.sh $1` 를 실행한다.
   - BE → `apps/api` + `packages/shared` 만 편집(=`apps/web` 편집 차단)
   - F1·F2 → `apps/web` + `packages/shared` 만 편집(=`apps/api`·`prisma` 차단)
   - 이 가드는 `.claude/settings.local.json`(개인 PC 전용, gitignore)으로 적용되며 **Claude Code 재시작 후 발효**된다는 점을 알려라.

3. **컨텍스트 로드** — 다음 문서를 읽고 이 역할에 맞춰 핵심만 추린다.
   - @Docs/00-Getting-Started.md  (§6 역할별 첫걸음)
   - @Docs/10-Team-Roles.md
   - @Docs/11-Conventions.md  (요점만)
   - 일정·이슈는 **Linear**(IEUM 워크스페이스)에서 관리 — 별도 문서 없음

4. **출력** — 아래를 간결하게 정리해 보여준다.
   - 🎯 **내 스코프**: 편집 가능 / 차단 폴더
   - 📋 **1주차(M1) 내 이슈**: **Linear**(IEUM)에서 `$1` 담당 이슈 확인 → `git lb <IEUM-id>`로 브랜치
   - ⚙️ **자주 쓰는 명령**: `pnpm dev`, `./scripts/check`, `git lb <IEUM-id>`(브랜치)·커밋(Conventional) 규칙
   - 🚦 **지금 바로 할 첫 작업 1개** (의존성 없이 선행 가능한 것 우선)
   - ⚠️ **기억할 가드**: push·merge는 사람이, 생성물 편집 금지, 계약 변경은 `api-contract-change` 스킬

> 참고: 이 역할(BE는 백엔드 전체, F1 캔버스/실시간, F2 셸/콘텐츠)은 3인 체제 기준이다(`10-Team-Roles.md`). BE가 단독 크리티컬 패스이므로 1주차 계약(스키마·DTO)이 최우선이다.
