---
name: db-migration
description: Prisma 스키마 변경과 마이그레이션 생성 절차. apps/api/prisma 또는 데이터 모델 변경 시 사용.
---

# DB Migration (Prisma)

1. **`Docs/08-ERD.md`를 먼저 갱신**(정본). `schema.prisma`를 거기에 일치시킨다.
2. 마이그레이션 생성: `pnpm --filter @markflow/api prisma:migrate --name <설명>`.
3. raw SQL 보강 항목 확인(Prisma가 직접 표현 못 함):
   - OWNER 부분 유니크: `CREATE UNIQUE INDEX project_single_owner ON "ProjectMember"("projectId") WHERE role='OWNER';`
   - Edge: `UNIQUE(sourceId, targetId)` + `CHECK(sourceId <> targetId)`.
4. **롤백 설명** 작성(되돌리는 방법).
5. 파괴적 변경이면 데이터 마이그레이션 계획을 별도로.
6. `migration-reviewer` 에이전트로 검토 후 PR.
