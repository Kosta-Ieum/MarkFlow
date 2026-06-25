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
