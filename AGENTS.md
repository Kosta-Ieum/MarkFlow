# MarkFlow — Agent Working Agreement

도구 무관 범용 규칙. (Claude Code는 `CLAUDE.md`의 `@AGENTS.md` import로 읽음.)

## 작업 원칙
- 정본은 `Docs/`. 추측 대신 해당 문서를 먼저 확인한다.
- 정해진 파일 범위만 수정한다. 다른 도메인이나 공개 계약을 바꿔야 하면 멈추고 보고한다.
- 무관한 리팩터링을 하지 않는다.
- 작성과 리뷰를 분리한다. 구현한 에이전트가 자기 결과를 최종 승인하지 않는다(별도 리뷰어 + 사람 리뷰).

## 도메인 경계 (상세 → `Docs/10-Team-Roles.md`)
- `apps/api` = **BE**(백엔드 전체: 소켓+REST+도메인) · `apps/web` = F1(캔버스·실시간) / F2(셸·콘텐츠)
- BE↔FE 계약 = `packages/shared` (DTO · `SOCKET_EVENTS` · `roomOf`)
- 경계를 넘는 변경(shared·공개 API)은 양쪽 + 문서 동시 갱신.

## 금지
- merge / deploy / 프로덕션 데이터 변경 / `main` 직접 push / force-push (feature 브랜치 push + PR 생성은 허용, merge는 사람 승인)
- 생성물(migrations, prisma client, dist) 편집
- 비밀(.env, secrets) 읽기

## 강제 (도구 무관 — Claude·자율 에이전트·사람 모두)
- 공용 **git hooks**(`.githooks/`, `core.hooksPath`로 등록 — `./scripts/bootstrap`이 자동): pre-commit = `main` 직접 커밋·생성물·비밀·기존 마이그레이션 수정 차단 / pre-push = `main` push 차단 + `./scripts/check`.
- **역할 스코프 가드(도구 무관)**: `./scripts/set-role.sh <BE|F1|F2>`가 `git config markflow.role`을 기록 → pre-commit이 범위 밖 경로 커밋 차단(BE↔`apps/web`, F1·F2↔`apps/api`). Claude의 `.claude/settings.local.json`과 동일 효과를 자율 에이전트·맨손 git에도 적용.
- 최종 방어선은 **GitHub 브랜치 보호 + PR 리뷰** — hook은 `--no-verify`로 우회 가능한 보조 가드다. 우회하지 말 것.
- Claude Code 전용 `.claude/settings.json` 가드는 다른 에이전트엔 적용되지 않는다 → 위 hook과 브랜치 보호가 공통 강제선이다.
