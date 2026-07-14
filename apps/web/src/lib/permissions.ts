// IEUM-40 [F2-4.1] 권한별 UI 폴리시 헬퍼.
// 프론트 비활성화는 UX용. 진짜 가드는 REST + Socket 양쪽 서버에서 수행.
import type { Role } from "@markflow/shared";

/** EDITOR 이상 — 노드 추가·수정·삭제·채팅 작성 등 편집 가능 여부 */
export const canEdit = (role: Role): boolean => role === "OWNER" || role === "EDITOR";

/** OWNER 전용 — 프로젝트 rename·삭제·멤버 관리 등 소유자 전용 동작 */
export const canManage = (role: Role): boolean => role === "OWNER";

/** 역할 한글 표시 라벨 — MembersModal의 배지 라벨과 동일하게 맞춘다.
 * Map으로 조회(.get)한다 — 리터럴 유니온이라 실질 위험은 없지만, 일반 객체 대괄호
 * 인덱싱(`obj[role]`)은 정적분석기가 Generic Object Injection Sink로 오탐하기 쉽다. */
export const ROLE_LABEL: ReadonlyMap<Role, string> = new Map([
  ["OWNER", "소유자"],
  ["EDITOR", "편집자"],
  ["VIEWER", "뷰어"],
]);
