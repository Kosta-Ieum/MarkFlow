---
name: pr-ready
description: PR을 올리기 전 검증·문서 정합·위험 보고를 준비한다. "PR 준비", "pr 올리기 전", "머지 전 점검" 등에 사용.
---

# PR Ready

1. `./scripts/check` 통과 확인.
2. 변경 파일이 선언한 범위 내인지 확인(다른 도메인 누수 없음).
3. 도메인 정합 점검:
   - 스키마 변경 → `Docs/08-ERD.md` 갱신 + 마이그레이션(`db-migration` 스킬).
   - `packages/shared` DTO/이벤트 변경 → `apps/api`·`apps/web` 양쪽 + `Docs/09-API-Spec.md`.
   - 권한 변경 → REST + Socket 양쪽.
4. PR 본문 작성(`.github/pull_request_template.md`): 작업 요약 / 주요 변경 사항 / 상세 작업 내용 / 테스트 결과 / 리뷰어에게 전달할 말
5. **push·merge는 사람이** 한다. 에이전트는 여기까지(별도 reviewer + 사람 리뷰 후).
