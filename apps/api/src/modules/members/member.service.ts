// MemberService (@Injectable) — REST·WS 공용 seam — 멤버십 로직
//
// 모든 변경 진입부에서 assertPermission(projectId, callerId, "OWNER"). 권한은 서버가 최종 가드.
// 변경 + ActivityLog는 한 $transaction (백엔드 불변식, .claude/rules/backend.md).
//
// 메서드 (controller가 주입받아 호출):
//   list(projectId)                          → Member[]   (멤버 누구나 조회)
//   invite(projectId, callerId, { email, role })  → Member  — OWNER only.
//        MVP는 기가입 유저만 초대(미가입 이메일 404), 이미 멤버 409, role ∈ EDITOR|VIEWER(OWNER 지정 불가).
//   updateRole(projectId, callerId, userId, { role }) → Member — OWNER only.
//        OWNER 역할 양도/지정 범위 밖(422), OWNER 본인 강등 불가.
//   remove(projectId, callerId, userId)      → { userId } — OWNER only. OWNER 본인 제거 불가(422).
//
// TODO(BE): 위 메서드 구현. shared 타입(Member, MemberInviteRequest, MemberUpdateRequest) 재사용.
