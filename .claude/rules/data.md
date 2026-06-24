---
paths:
  - "apps/api/prisma/**"
---

# Data model invariants (Prisma)

정본 → `Docs/08-ERD.md` (schema.prisma는 이를 반영)

- 캔버스 본문은 **Node/Edge 정규화**. JSONB 통째 저장 금지.
- 소프트 삭제(`deletedAt`): **Project, Node**. 활성 조회는 항상 `deletedAt IS NULL`.
- **ActivityLog**: 폴리모픽(`targetType` NODE/EDGE/PROJECT), `targetId`는 FK 아님 · **불변 로그**(영구삭제돼도 댕글링 유지).
- **OWNER 1명**: `CREATE UNIQUE INDEX ... ON "ProjectMember"("projectId") WHERE role='OWNER'` (raw SQL 마이그레이션).
- **Edge**: `UNIQUE(sourceId, targetId)` + `CHECK(sourceId <> targetId)` (raw SQL).
- 스키마 변경 = 마이그레이션 + 롤백 설명 + `Docs/08-ERD.md` 동시 갱신. `migrations/` 생성물 수동 편집 금지.
- 절차는 `db-migration` 스킬 참조.
