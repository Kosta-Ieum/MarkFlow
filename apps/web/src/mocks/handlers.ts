// MSW v2 http 핸들러 — auth/projects/canvas/nodes/messages/history를 stateful in-memory로 응답.
// 응답 envelope는 apps/api/openapi.yaml 정본과 일치시킨다.
// 핸들러 URL base는 lib/api()와 동일해야 한다(api()는 `${VITE_API_BASE ?? "http://localhost:4000"}${path}`).
import { http, HttpResponse, delay } from "msw";
import type {
  AuthResponse,
  RefreshResponse,
  User,
  ProjectsResponse,
  ProjectSummary,
  ProjectUpdateResponse,
  ProjectDeleteResponse,
  CanvasSnapshot,
  NodeDTO,
  ChatMessageDTO,
  ActivityDTO,
  ErrorResponse,
  MembersResponse,
  MemberInviteRequest,
  MemberUpdateRequest,
  MemberDeleteResponse,
  SendCodeResponse,
  VerifyEmailResponse,
} from "@markflow/shared";

import {
  db,
  findProject,
  activeProjects,
  toProjectSummary,
  createProject,
  deleteProject,
  renameProject,
  updateNode,
  addMessage,
  loginAs,
  issueToken,
  generateCode,
  verifyCode,
  getMembersForProject,
  inviteMember,
  updateMemberRole,
  removeMember,
} from "./db";

// api()의 BASE와 동일해야 핸들러가 매칭된다.
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:4000";
const url = (path: string): string => `${BASE}${path}`;

// 로딩 UI 확인용 약간의 지연.
const LATENCY_MS = 250;

// 웹이 기대하는 응답 envelope(openapi MessagesResponse / HistoryResponse).
interface MessagesResponse {
  messages: ChatMessageDTO[];
  nextCursor: string | null;
}
interface HistoryResponse {
  history: ActivityDTO[];
  nextCursor: string | null;
}

function notFound(message = "찾을 수 없습니다.") {
  const body: ErrorResponse = { error: { code: "NOT_FOUND", message, details: null } };
  return HttpResponse.json(body, { status: 404 });
}

function badRequest(message: string) {
  const body: ErrorResponse = { error: { code: "VALIDATION_ERROR", message, details: null } };
  return HttpResponse.json(body, { status: 400 });
}

export const handlers = [
  // ── Auth ───────────────────────────────────────────────────────────────────
  // 데모용: 아무 자격증명이나 성공. 입력 email로 user 구성 후 토큰 발급.
  http.post(url("/auth/signup"), async ({ request }) => {
    await delay(LATENCY_MS);
    const body = (await request.json().catch(() => ({}))) as Partial<{
      name: string;
      email: string;
      password: string;
    }>;
    if (!body.email) return badRequest("email이 필요합니다.");
    const { user, accessToken } = loginAs(body.email, body.name);
    const res: AuthResponse = { accessToken, user };
    return HttpResponse.json(res, { status: 201 });
  }),

  http.post(url("/auth/login"), async ({ request }) => {
    await delay(LATENCY_MS);
    const body = (await request.json().catch(() => ({}))) as Partial<{
      email: string;
      password: string;
    }>;
    if (!body.email) return badRequest("email이 필요합니다.");
    const { user, accessToken } = loginAs(body.email);
    const res: AuthResponse = { accessToken, user };
    return HttpResponse.json(res, { status: 200 });
  }),

  http.get(url("/auth/me"), async () => {
    await delay(LATENCY_MS);
    const me: User = db.user;
    return HttpResponse.json(me, { status: 200 });
  }),

  http.post(url("/auth/refresh"), async () => {
    await delay(LATENCY_MS);
    const res: RefreshResponse = { accessToken: issueToken(db.user.id) };
    return HttpResponse.json(res, { status: 200 });
  }),

  http.post(url("/auth/logout"), async () => {
    await delay(LATENCY_MS);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Email OTP (mock 전용 — TODO(계약): openapi /auth/email/* 추가 시 삭제) ──────
  // 실서버는 verify된 이메일만 signup 허용; 목에서는 단순화.
  http.post(url("/auth/email/send-code"), async ({ request }) => {
    await delay(LATENCY_MS);
    const body = (await request.json().catch(() => ({}))) as Partial<{ email: string }>;
    if (!body.email) return badRequest("email이 필요합니다.");
    const code = generateCode(body.email);
    // devCode는 dev/mock 전용 편의 필드(실서버 SendCodeResponse엔 없음 — shared 계약).
    const res: SendCodeResponse & { devCode?: string } = { sent: true, devCode: code };
    return HttpResponse.json(res, { status: 200 });
  }),

  http.post(url("/auth/email/verify"), async ({ request }) => {
    await delay(LATENCY_MS);
    const body = (await request.json().catch(() => ({}))) as Partial<{
      email: string;
      code: string;
    }>;
    if (!body.email || !body.code) return badRequest("email과 code가 필요합니다.");
    const ok = verifyCode(body.email, body.code);
    if (!ok) {
      const errBody: ErrorResponse = {
        error: { code: "INVALID_CODE", message: "인증 코드가 올바르지 않습니다.", details: null },
      };
      return HttpResponse.json(errBody, { status: 400 });
    }
    const res: VerifyEmailResponse = { verified: true };
    return HttpResponse.json(res, { status: 200 });
  }),

  // ── Projects ─────────────────────────────────────────────────────────────
  http.get(url("/projects"), async () => {
    await delay(LATENCY_MS);
    const res: ProjectsResponse = { projects: activeProjects().map(toProjectSummary) };
    return HttpResponse.json(res, { status: 200 });
  }),

  http.post(url("/projects"), async ({ request }) => {
    await delay(LATENCY_MS);
    const body = (await request.json().catch(() => ({}))) as Partial<{ name: string }>;
    if (!body.name) return badRequest("name이 필요합니다.");
    const record = createProject(body.name);
    const res: ProjectSummary = toProjectSummary(record);
    return HttpResponse.json(res, { status: 201 });
  }),

  http.patch(url("/projects/:projectId"), async ({ params, request }) => {
    await delay(LATENCY_MS);
    const body = (await request.json().catch(() => ({}))) as Partial<{ name: string }>;
    if (!body.name) return badRequest("name이 필요합니다.");
    const record = renameProject(params.projectId as string, body.name);
    if (!record) return notFound("프로젝트를 찾을 수 없습니다.");
    const res: ProjectUpdateResponse = {
      id: record.id,
      name: record.name,
      updatedAt: record.updatedAt,
    };
    return HttpResponse.json(res, { status: 200 });
  }),

  http.delete(url("/projects/:projectId"), async ({ params }) => {
    await delay(LATENCY_MS);
    // 하드 삭제 — 휴지통/복구 없음. db에서 영구 제거.
    const removed = deleteProject(params.projectId as string);
    if (!removed) return notFound("프로젝트를 찾을 수 없습니다.");
    const res: ProjectDeleteResponse = { id: removed.id, deleted: true };
    return HttpResponse.json(res, { status: 200 });
  }),

  // ── Canvas / Nodes ─────────────────────────────────────────────────────────
  http.get(url("/projects/:projectId/canvas"), async ({ params }) => {
    await delay(LATENCY_MS);
    const record = findProject(params.projectId as string);
    if (!record) return notFound("프로젝트를 찾을 수 없습니다.");
    const res: CanvasSnapshot = {
      project: { id: record.id, name: record.name, role: record.role },
      nodes: record.nodes,
      edges: record.edges,
    };
    return HttpResponse.json(res, { status: 200 });
  }),

  http.patch(url("/projects/:projectId/nodes/:nodeId"), async ({ params, request }) => {
    await delay(LATENCY_MS);
    const patch = (await request.json().catch(() => ({}))) as Partial<
      Pick<NodeDTO, "title" | "markdown" | "type" | "collapsed" | "position">
    >;
    const node = updateNode(params.projectId as string, params.nodeId as string, patch);
    if (!node) return notFound("노드를 찾을 수 없습니다.");
    return HttpResponse.json(node, { status: 200 });
  }),

  // ── Chat ─────────────────────────────────────────────────────────────────
  http.get(url("/projects/:projectId/messages"), async ({ params }) => {
    await delay(LATENCY_MS);
    const record = findProject(params.projectId as string);
    if (!record) return notFound("프로젝트를 찾을 수 없습니다.");
    const res: MessagesResponse = { messages: record.messages, nextCursor: null };
    return HttpResponse.json(res, { status: 200 });
  }),

  http.post(url("/projects/:projectId/messages"), async ({ params, request }) => {
    await delay(LATENCY_MS);
    const body = (await request.json().catch(() => ({}))) as Partial<{ content: string }>;
    if (!body.content) return badRequest("content가 필요합니다.");
    const message = addMessage(params.projectId as string, body.content);
    if (!message) return notFound("프로젝트를 찾을 수 없습니다.");
    return HttpResponse.json(message, { status: 201 });
  }),

  // ── History ──────────────────────────────────────────────────────────────
  http.get(url("/projects/:projectId/history"), async ({ params }) => {
    await delay(LATENCY_MS);
    const record = findProject(params.projectId as string);
    if (!record) return notFound("프로젝트를 찾을 수 없습니다.");
    const res: HistoryResponse = { history: record.history, nextCursor: null };
    return HttpResponse.json(res, { status: 200 });
  }),

  // ── Members ───────────────────────────────────────────────────────────────
  http.get(url("/projects/:projectId/members"), async ({ params }) => {
    await delay(LATENCY_MS);
    const projectId = params.projectId as string;
    if (!findProject(projectId)) return notFound("프로젝트를 찾을 수 없습니다.");
    const res: MembersResponse = { members: getMembersForProject(projectId) };
    return HttpResponse.json(res, { status: 200 });
  }),

  http.post(url("/projects/:projectId/members"), async ({ params, request }) => {
    await delay(LATENCY_MS);
    const projectId = params.projectId as string;
    if (!findProject(projectId)) return notFound("프로젝트를 찾을 수 없습니다.");
    const body = (await request.json().catch(() => ({}))) as Partial<MemberInviteRequest>;
    if (!body.email || !body.role) return badRequest("email과 role이 필요합니다.");
    const member = inviteMember(projectId, body.email, body.role);
    if (member === null) {
      const errBody: ErrorResponse = {
        error: { code: "ALREADY_MEMBER", message: "이미 프로젝트 멤버입니다.", details: null },
      };
      return HttpResponse.json(errBody, { status: 409 });
    }
    return HttpResponse.json(member, { status: 201 });
  }),

  http.patch(url("/projects/:projectId/members/:userId"), async ({ params, request }) => {
    await delay(LATENCY_MS);
    const projectId = params.projectId as string;
    const userId = params.userId as string;
    if (!findProject(projectId)) return notFound("프로젝트를 찾을 수 없습니다.");
    const body = (await request.json().catch(() => ({}))) as Partial<MemberUpdateRequest>;
    if (!body.role) return badRequest("role이 필요합니다.");
    const member = updateMemberRole(projectId, userId, body.role);
    if (!member) return notFound("멤버를 찾을 수 없습니다.");
    return HttpResponse.json(member, { status: 200 });
  }),

  http.delete(url("/projects/:projectId/members/:userId"), async ({ params }) => {
    await delay(LATENCY_MS);
    const projectId = params.projectId as string;
    const userId = params.userId as string;
    if (!findProject(projectId)) return notFound("프로젝트를 찾을 수 없습니다.");
    const result = removeMember(projectId, userId);
    if (result === undefined) return notFound("멤버를 찾을 수 없습니다.");
    if (result === "OWNER") {
      const errBody: ErrorResponse = {
        error: { code: "CANNOT_REMOVE_OWNER", message: "OWNER는 제거할 수 없습니다.", details: null },
      };
      return HttpResponse.json(errBody, { status: 403 });
    }
    const res: MemberDeleteResponse = { userId: result };
    return HttpResponse.json(res, { status: 200 });
  }),
];
