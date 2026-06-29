// DTO 계약 단위 테스트 — schemas.ts (BE↔FE 공용 zod). 형태/포맷/제약이 조용히 깨지는 걸 막는다.
import { describe, it, expect } from "vitest";
import {
  RoleSchema,
  NodeTypeSchema,
  NodeDTOSchema,
  UserSchema,
  SignupRequestSchema,
  ProjectCreateRequestSchema,
  ProjectSummarySchema,
  MemberInviteRequestSchema,
  MemberUpdateRequestSchema,
  ChatMessageDTOSchema,
} from "./schemas";

const UUID = "11111111-1111-4111-8111-111111111111";
const ISO = "2026-06-29T12:00:00.000Z";

describe("enums", () => {
  it("RoleSchema는 OWNER/EDITOR/VIEWER만 허용한다", () => {
    expect(RoleSchema.safeParse("OWNER").success).toBe(true);
    expect(RoleSchema.safeParse("EDITOR").success).toBe(true);
    expect(RoleSchema.safeParse("VIEWER").success).toBe(true);
    expect(RoleSchema.safeParse("ADMIN").success).toBe(false);
  });

  it("NodeTypeSchema는 정의된 5종만 허용한다", () => {
    for (const t of ["idea", "doc", "task", "decision", "data"]) {
      expect(NodeTypeSchema.safeParse(t).success).toBe(true);
    }
    expect(NodeTypeSchema.safeParse("note").success).toBe(false);
  });
});

describe("NodeDTOSchema", () => {
  const base = {
    id: UUID,
    type: "idea",
    title: "t",
    markdown: "# m",
    collapsed: false,
    position: { x: 1, y: 2 },
  };

  it("필수 필드가 있으면 통과하고 updatedAt은 선택이다", () => {
    expect(NodeDTOSchema.safeParse(base).success).toBe(true);
    expect(NodeDTOSchema.safeParse({ ...base, updatedAt: ISO }).success).toBe(true);
  });

  it("position이 없으면 실패한다", () => {
    const { position, ...noPos } = base;
    expect(NodeDTOSchema.safeParse(noPos).success).toBe(false);
  });

  it("id가 uuid가 아니면 실패한다", () => {
    expect(NodeDTOSchema.safeParse({ ...base, id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("Auth 포맷 제약", () => {
  it("UserSchema는 email 형식과 uuid를 검증한다", () => {
    expect(UserSchema.safeParse({ id: UUID, email: "a@b.com", name: "A" }).success).toBe(true);
    expect(UserSchema.safeParse({ id: UUID, email: "bad", name: "A" }).success).toBe(false);
  });

  it("SignupRequestSchema는 비밀번호 8자 미만을 거부한다", () => {
    const ok = { name: "A", email: "a@b.com", password: "12345678" };
    expect(SignupRequestSchema.safeParse(ok).success).toBe(true);
    expect(SignupRequestSchema.safeParse({ ...ok, password: "1234567" }).success).toBe(false);
  });
});

describe("Project 제약", () => {
  it("ProjectCreateRequestSchema는 name 120자 초과를 거부한다", () => {
    expect(ProjectCreateRequestSchema.safeParse({ name: "x".repeat(120) }).success).toBe(true);
    expect(ProjectCreateRequestSchema.safeParse({ name: "x".repeat(121) }).success).toBe(false);
  });

  it("ProjectSummarySchema의 nodeCount는 음수/소수를 거부한다", () => {
    const base = { id: UUID, name: "P", role: "OWNER", isOwner: true, updatedAt: ISO };
    expect(ProjectSummarySchema.safeParse({ ...base, nodeCount: 0 }).success).toBe(true);
    expect(ProjectSummarySchema.safeParse({ ...base, nodeCount: -1 }).success).toBe(false);
    expect(ProjectSummarySchema.safeParse({ ...base, nodeCount: 1.5 }).success).toBe(false);
  });
});

describe("Member 역할 제약 (OWNER 승격 금지)", () => {
  it("초대/역할변경 role은 EDITOR|VIEWER만 허용하고 OWNER를 거부한다", () => {
    expect(MemberInviteRequestSchema.safeParse({ email: "a@b.com", role: "EDITOR" }).success).toBe(true);
    expect(MemberInviteRequestSchema.safeParse({ email: "a@b.com", role: "OWNER" }).success).toBe(false);
    expect(MemberUpdateRequestSchema.safeParse({ role: "VIEWER" }).success).toBe(true);
    expect(MemberUpdateRequestSchema.safeParse({ role: "OWNER" }).success).toBe(false);
  });
});

describe("ChatMessageDTOSchema", () => {
  it("createdAt은 ISO datetime이어야 한다", () => {
    const ok = { id: UUID, content: "hi", createdAt: ISO, user: { id: UUID, name: "A" } };
    expect(ChatMessageDTOSchema.safeParse(ok).success).toBe(true);
    expect(ChatMessageDTOSchema.safeParse({ ...ok, createdAt: "2026-06-29" }).success).toBe(false);
  });
});
