-- 프로젝트당 OWNER 1명 보장 (부분 유니크 인덱스)
-- 롤백: DROP INDEX IF EXISTS project_single_owner;
CREATE UNIQUE INDEX project_single_owner
ON "ProjectMember"("projectId")
WHERE role = 'OWNER';

-- 엣지 자기연결 금지 (sourceId = targetId 차단)
-- 롤백: ALTER TABLE "Edge" DROP CONSTRAINT IF EXISTS edge_no_self_loop;
ALTER TABLE "Edge"
ADD CONSTRAINT edge_no_self_loop
CHECK ("sourceId" <> "targetId");