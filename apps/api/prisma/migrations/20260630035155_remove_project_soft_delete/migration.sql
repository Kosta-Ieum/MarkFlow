-- 프로젝트 휴지통(소프트 삭제) 제거 → 하드 삭제로 전환.
-- 프로젝트는 deletedAt 없이 물리 삭제(복구 없음). 하위 Node/Edge/ChatMessage/ActivityLog는 기존 FK ON DELETE CASCADE로 함께 제거된다.
-- Node.deletedAt(노드 휴지통)은 그대로 유지한다.
--
-- 롤백:
--   ALTER TABLE "Project" ADD COLUMN "deletedAt" TIMESTAMP(3);
--   CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- DropIndex
DROP INDEX "Project_deletedAt_idx";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "deletedAt";
