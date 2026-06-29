// IEUM-40 [F2-4.1] 권한별 UI 폴리시 헬퍼.
// 프론트 비활성화는 UX용. 진짜 가드는 REST + Socket 양쪽 서버에서 수행.
import type { Role } from "@markflow/shared";

/** EDITOR 이상 — 노드 추가·수정·삭제·채팅 작성 등 편집 가능 여부 */
export const canEdit = (role: Role): boolean => role === "OWNER" || role === "EDITOR";

/** OWNER 전용 — 프로젝트 rename·삭제·멤버 관리 등 소유자 전용 동작 */
export const canManage = (role: Role): boolean => role === "OWNER";
