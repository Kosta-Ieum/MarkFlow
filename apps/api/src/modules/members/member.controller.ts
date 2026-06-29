// MemberController (@Controller("projects/:projectId/members")) — 멤버 초대·권한변경·제거 라우트 (OWNER)
//
// REST 계약 정본: apps/api/openapi.yaml (/projects/{projectId}/members 외).
// 공용 DTO·zod: @markflow/shared — MemberSchema, MembersResponseSchema,
//   MemberInviteRequestSchema, MemberUpdateRequestSchema, MemberDeleteResponseSchema.
//
// 엔드포인트 (전송만 — 입력 파싱·service 호출·응답. 권한 if문·Prisma 직접 호출 금지):
//   GET    /projects/:projectId/members           → list       (멤버 누구나) → MembersResponse
//   POST   /projects/:projectId/members           → invite     (OWNER)      body MemberInviteRequest → Member(201)
//   PATCH  /projects/:projectId/members/:userId    → updateRole (OWNER)      body MemberUpdateRequest → Member
//   DELETE /projects/:projectId/members/:userId    → remove     (OWNER)      → MemberDeleteResponse
//
// TODO(BE): MemberService를 주입해 위 4개 라우트 구현. body는 shared zod로 검증.
