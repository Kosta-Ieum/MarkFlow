// MSW dev 목 — stateful in-memory store + 시드 데이터.
// VITE_MOCK_API=1 일 때만 main.tsx에서 동적 import로 기동(프로덕션/실BE 무영향).
// 타입은 @markflow/shared 정본에서만 import — 로컬 재정의 금지.
import type {
  User,
  ProjectSummary,
  NodeDTO,
  EdgeDTO,
  ChatMessageDTO,
  ActivityDTO,
  Role,
  Member,
} from "@markflow/shared";

// ── 유틸 ─────────────────────────────────────────────────────────────────────

let idSeq = 0;
// 탭마다 db.ts 모듈이 독립 실행되므로(아래 localStorage 동기화 참고), idSeq만으로는
// 여러 탭이 동시에 새 id를 만들 때 충돌할 수 있다 — 탭별 랜덤 salt를 섞어 고유성 확보.
const TAB_SALT = Math.random().toString(16).slice(2, 6).padStart(4, "0");
/** 시드/런타임 공용 UUID 생성기(데모용 — 형식만 uuid면 충분, 탭 간 고유성 보장). */
export function uuid(): string {
  idSeq += 1;
  const hex = idSeq.toString(16).padStart(8, "0");
  return `00000000-0000-4000-8000-${TAB_SALT}${hex}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** 데모용 가짜 JWT(검증 안 함 — 핸들러는 Bearer 없이도 동작). */
export function issueToken(userId: string): string {
  return `mock.${userId}.${Date.now().toString(36)}`;
}

// ── 시드 식별자 ──────────────────────────────────────────────────────────────

const DEMO_USER_ID = uuid();
const PROJECT_ROADMAP_ID = uuid();
const PROJECT_BLOG_ID = uuid();
const PROJECT_RESEARCH_ID = uuid();

// ── store 타입 ───────────────────────────────────────────────────────────────

interface ProjectRecord {
  id: string;
  name: string;
  role: Role;
  isOwner: boolean;
  updatedAt: string;
  nodes: NodeDTO[];
  edges: EdgeDTO[];
  /** 소프트 삭제된 노드 — §CV-16 휴지통. NodeDTO + deletedAt. */
  trashedNodes: (NodeDTO & { deletedAt: string })[];
  messages: ChatMessageDTO[];
  history: ActivityDTO[];
}

interface MockDb {
  user: User;
  projects: ProjectRecord[];
  /** email → 6자리 OTP 코드 (mock 전용). 실서버는 별도 저장소 사용. */
  verificationCodes: Record<string, string>;
  /** projectId → Member[] (프로젝트별 멤버 목록). */
  members: Record<string, Member[]>;
  /** email → 회원가입 시 입력한 이름. 로그인(이름 없이)할 때 이걸로 복원한다. */
  knownUsers: Record<string, string>;
}

// ── 시드 데이터 ──────────────────────────────────────────────────────────────

const demoUser: User = {
  id: DEMO_USER_ID,
  email: "demo@markflow.app",
  name: "데모 사용자",
};

// 시드 시점 작성자(고정). 런타임 변이는 currentUserRef()로 현재 user를 반영.
const userRef = { id: demoUser.id, name: demoUser.name };

function currentUserRef(): { id: string; name: string } {
  return { id: db.user.id, name: db.user.name };
}

function seedNodes(): NodeDTO[] {
  return [
    {
      id: uuid(),
      type: "idea",
      title: "킥오프 아이디어",
      markdown: "# 킥오프\n- 목표 정리\n- 범위 합의",
      collapsed: false,
      position: { x: 80, y: 80 },
      updatedAt: isoMinutesAgo(120),
    },
    {
      id: uuid(),
      type: "doc",
      title: "제품 개요 문서",
      markdown: "## 개요\n마크다운 노드 기반 협업 캔버스.",
      collapsed: false,
      position: { x: 360, y: 80 },
      updatedAt: isoMinutesAgo(90),
    },
    {
      id: uuid(),
      type: "task",
      title: "스프린트 1 백로그",
      markdown: "- [ ] 캔버스 렌더\n- [ ] 실시간 커서",
      collapsed: true,
      position: { x: 360, y: 300 },
      updatedAt: isoMinutesAgo(60),
    },
    {
      id: uuid(),
      type: "decision",
      title: "기술 스택 결정",
      markdown: "React Flow + Socket.io 채택.",
      collapsed: false,
      position: { x: 80, y: 300 },
      updatedAt: isoMinutesAgo(45),
    },
    {
      id: uuid(),
      type: "data",
      title: "사용자 지표",
      markdown: "| 주차 | DAU |\n| --- | --- |\n| 1 | 12 |",
      collapsed: false,
      position: { x: 640, y: 200 },
      updatedAt: isoMinutesAgo(20),
    },
  ];
}

function seedEdges(nodes: NodeDTO[]): EdgeDTO[] {
  return [
    { id: uuid(), source: nodes[0].id, target: nodes[1].id },
    { id: uuid(), source: nodes[1].id, target: nodes[2].id },
    { id: uuid(), source: nodes[0].id, target: nodes[3].id },
  ];
}

function seedMessages(): ChatMessageDTO[] {
  return [
    {
      id: uuid(),
      content: "안녕하세요! 캔버스 작업 시작합니다.",
      createdAt: isoMinutesAgo(115),
      user: userRef,
    },
    {
      id: uuid(),
      content: "노드 몇 개 추가해뒀어요.",
      createdAt: isoMinutesAgo(58),
      user: userRef,
    },
    {
      id: uuid(),
      content: "결정 노드 검토 부탁드립니다.",
      createdAt: isoMinutesAgo(18),
      user: userRef,
    },
  ];
}

function seedHistory(nodes: NodeDTO[]): ActivityDTO[] {
  return [
    {
      id: uuid(),
      targetType: "NODE",
      targetId: nodes[0].id,
      targetLabel: nodes[0].title,
      action: "CREATE",
      createdAt: isoMinutesAgo(120),
      user: userRef,
    },
    {
      id: uuid(),
      targetType: "NODE",
      targetId: nodes[1].id,
      targetLabel: nodes[1].title,
      action: "UPDATE",
      createdAt: isoMinutesAgo(88),
      user: userRef,
    },
    {
      id: uuid(),
      targetType: "EDGE",
      targetId: null,
      targetLabel: "연결",
      action: "CONNECT",
      createdAt: isoMinutesAgo(70),
      user: userRef,
    },
    {
      id: uuid(),
      targetType: "NODE",
      targetId: nodes[2].id,
      targetLabel: nodes[2].title,
      action: "MOVE",
      createdAt: isoMinutesAgo(40),
      user: userRef,
    },
  ];
}

function buildProject(
  id: string,
  name: string,
  role: Role,
  updatedMinutesAgo: number,
): ProjectRecord {
  const nodes = seedNodes();
  return {
    id,
    name,
    role,
    isOwner: role === "OWNER",
    updatedAt: isoMinutesAgo(updatedMinutesAgo),
    nodes,
    edges: seedEdges(nodes),
    trashedNodes: [],
    messages: seedMessages(),
    history: seedHistory(nodes),
  };
}

// ── 멤버 시드 헬퍼 ────────────────────────────────────────────────────────────

/** 각 프로젝트의 초기 멤버 목록을 생성한다. OWNER는 데모 user, 나머지는 샘플. */
function seedMembers(ownerRole: Role): Member[] {
  const owner: Member = {
    userId: DEMO_USER_ID,
    name: demoUser.name,
    email: demoUser.email,
    role: "OWNER",
  };
  if (ownerRole === "OWNER") {
    return [
      owner,
      {
        userId: uuid(),
        name: "editor",
        email: "editor@markflow.app",
        role: "EDITOR",
      },
      {
        userId: uuid(),
        name: "viewer",
        email: "viewer@markflow.app",
        role: "VIEWER",
      },
    ];
  }
  // 데모 user가 OWNER가 아닌 프로젝트는 다른 사람이 OWNER
  return [
    {
      userId: uuid(),
      name: "alice",
      email: "alice@markflow.app",
      role: "OWNER",
    },
    {
      userId: DEMO_USER_ID,
      name: demoUser.name,
      email: demoUser.email,
      role: ownerRole,
    },
  ];
}

// ── store 인스턴스(모듈 단일 — in-memory) ────────────────────────────────────

export const db: MockDb = {
  user: demoUser,
  verificationCodes: {},
  projects: [
    // role 섞어서 권한 UI(OWNER/EDITOR/VIEWER) 확인 가능
    buildProject(PROJECT_ROADMAP_ID, "제품 로드맵", "OWNER", 5),
    buildProject(PROJECT_BLOG_ID, "블로그 초안", "EDITOR", 30),
    buildProject(PROJECT_RESEARCH_ID, "리서치 보드", "VIEWER", 180),
  ],
  members: {
    [PROJECT_ROADMAP_ID]: seedMembers("OWNER"),
    [PROJECT_BLOG_ID]: seedMembers("EDITOR"),
    [PROJECT_RESEARCH_ID]: seedMembers("VIEWER"),
  },
  knownUsers: { [demoUser.email]: demoUser.name },
};

// ── 탭 간 동기화 ─────────────────────────────────────────────────────────────
// db.ts는 탭(=page)마다 별도 JS 모듈 인스턴스라 메모리가 공유 안 된다(실DB가 아님).
// projects/members만 localStorage + "storage" 이벤트로 다른 탭에 릴레이한다.
// db.user(로그인 계정)는 탭마다 다른 게 맞으므로 동기화 대상에서 제외.
const SHARED_STORAGE_KEY = "markflow-mock-shared-db";
// 다른 탭에서 storage 이벤트로 db가 갱신됐음을 앱(React Query)에 알리는 커스텀 이벤트명.
// db.ts는 React Query를 모르므로, 구독은 앱 쪽(useMockSync 등)에서 한다.
export const MOCK_DB_UPDATED_EVENT = "markflow-mock-db-updated";

interface SharedSnapshot {
  projects: ProjectRecord[];
  members: Record<string, Member[]>;
  knownUsers: Record<string, string>;
}

function persistShared(): void {
  const snapshot: SharedSnapshot = { projects: db.projects, members: db.members, knownUsers: db.knownUsers };
  localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(snapshot));
}

function hydrateFromStorage(): boolean {
  const raw = localStorage.getItem(SHARED_STORAGE_KEY);
  if (!raw) return false;
  try {
    const snapshot = JSON.parse(raw) as SharedSnapshot;
    db.projects = snapshot.projects;
    db.members = snapshot.members;
    db.knownUsers = { ...db.knownUsers, ...snapshot.knownUsers };
    return true;
  } catch {
    return false;
  }
}

if (!hydrateFromStorage()) {
  // 이 탭이 첫 시드 — 다른 탭이 hydrate할 수 있게 즉시 기록.
  persistShared();
}

// db.user(= "이 탭에서 현재 로그인된 사람")는 모듈이 새로고침마다 재실행되며 매번
// 시드 데모 user로 리셋된다 — authStore(FE)는 sessionStorage로 탭별 세션을 유지하게
// 고쳤는데 mock 백엔드 쪽이 안 맞으면 새로고침 후 "내 메시지" 판별·락 주체 등이 다시 어긋난다.
// sessionStorage(탭 전용, localStorage와 달리 다른 탭과 공유 안 됨)에 이 탭의 로그인 user를
// 함께 보존한다.
const USER_STORAGE_KEY = "markflow-mock-user";

function persistUser(): void {
  sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(db.user));
}

function hydrateUserFromStorage(): void {
  const raw = sessionStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return;
  try {
    db.user = JSON.parse(raw) as User;
  } catch {
    // 무시 — 시드 데모 user 그대로 유지.
  }
}

hydrateUserFromStorage();

window.addEventListener("storage", (e) => {
  if (e.key !== SHARED_STORAGE_KEY || !e.newValue) return;
  try {
    const snapshot = JSON.parse(e.newValue) as SharedSnapshot;
    db.projects = snapshot.projects;
    db.members = snapshot.members;
    db.knownUsers = { ...db.knownUsers, ...snapshot.knownUsers };
    window.dispatchEvent(new CustomEvent(MOCK_DB_UPDATED_EVENT));
  } catch {
    // 무시 — 다음 변이에서 다시 맞춰진다.
  }
});

// ── 멤버십 ───────────────────────────────────────────────────────────────────

function isMember(projectId: string, email: string): boolean {
  return (db.members[projectId] ?? []).some((m) => m.email === email);
}

export function roleOf(projectId: string, email: string): Role {
  return (db.members[projectId] ?? []).find((m) => m.email === email)?.role ?? "VIEWER";
}

// ── 셀렉터 ───────────────────────────────────────────────────────────────────
// 같은 projects/members를 여러 계정(탭)이 공유하므로, role/isOwner는 레코드의
// 정적 필드가 아니라 "현재 로그인한 db.user 기준 멤버십"으로 매번 계산한다.

export function findProject(id: string): ProjectRecord | undefined {
  return db.projects.find((p) => p.id === id);
}

export function activeProjects(): ProjectRecord[] {
  return db.projects.filter((p) => isMember(p.id, db.user.email));
}

// ── 매핑(record → 응답 DTO) ──────────────────────────────────────────────────

export function toProjectSummary(p: ProjectRecord): ProjectSummary {
  const role = roleOf(p.id, db.user.email);
  return {
    id: p.id,
    name: p.name,
    role,
    isOwner: role === "OWNER",
    nodeCount: p.nodes.length,
    updatedAt: p.updatedAt,
  };
}

// ── 변이(런타임 CRUD가 상태에 반영) ──────────────────────────────────────────

export function createProject(name: string): ProjectRecord {
  // 새 프로젝트는 빈 캔버스로 시작.
  const record: ProjectRecord = {
    id: uuid(),
    name,
    role: "OWNER",
    isOwner: true,
    updatedAt: isoNow(),
    nodes: [],
    edges: [],
    trashedNodes: [],
    messages: [],
    history: [
      {
        id: uuid(),
        targetType: "PROJECT",
        targetId: null,
        targetLabel: name,
        action: "CREATE",
        createdAt: isoNow(),
        user: currentUserRef(),
      },
    ],
  };
  db.projects.unshift(record);
  db.members[record.id] = [
    { userId: db.user.id, name: db.user.name, email: db.user.email, role: "OWNER" },
  ];
  persistShared();
  return record;
}

export function deleteProject(id: string): ProjectRecord | undefined {
  // 하드 삭제 — db에서 영구 제거(복구 없음). 멤버 목록도 함께 제거.
  const idx = db.projects.findIndex((p) => p.id === id);
  if (idx === -1) return undefined;
  const [removed] = db.projects.splice(idx, 1);
  delete db.members[id];
  persistShared();
  return removed;
}

export function renameProject(id: string, name: string): ProjectRecord | undefined {
  const p = findProject(id);
  if (!p) return undefined;
  p.name = name;
  p.updatedAt = isoNow();
  prependActivity(p, {
    targetType: "PROJECT",
    targetId: null,
    targetLabel: name,
    action: "RENAME",
  });
  persistShared();
  return p;
}

export function updateNode(
  projectId: string,
  nodeId: string,
  patch: Partial<Pick<NodeDTO, "title" | "markdown" | "type" | "collapsed" | "position">>,
): NodeDTO | undefined {
  const p = findProject(projectId);
  if (!p) return undefined;
  const node = p.nodes.find((n) => n.id === nodeId);
  if (!node) return undefined;

  if (patch.title !== undefined) node.title = patch.title;
  if (patch.markdown !== undefined) node.markdown = patch.markdown;
  if (patch.type !== undefined) node.type = patch.type;
  if (patch.collapsed !== undefined) node.collapsed = patch.collapsed;
  if (patch.position !== undefined) node.position = patch.position;
  node.updatedAt = isoNow();
  p.updatedAt = node.updatedAt;

  // 위치만 변경하면 MOVE, 그 외는 UPDATE
  const onlyPosition =
    patch.position !== undefined &&
    patch.title === undefined &&
    patch.markdown === undefined &&
    patch.type === undefined &&
    patch.collapsed === undefined;
  prependActivity(p, {
    targetType: "NODE",
    targetId: node.id,
    targetLabel: node.title,
    action: onlyPosition ? "MOVE" : "UPDATE",
  });
  persistShared();
  return node;
}

/** 캔버스 일괄 저장(§CV-17/18) — nodes/edges 전체 교체. trashedNodes는 별도 관리. */
export function replaceCanvas(
  projectId: string,
  nodes: NodeDTO[],
  edges: EdgeDTO[],
): ProjectRecord | undefined {
  const p = findProject(projectId);
  if (!p) return undefined;
  // 노드 생성은 별도 POST /nodes 없이 이 일괄저장(자동저장) 경로로만 들어온다 — 그래서
  // CREATE가 히스토리에 한 번도 안 남았다. 이전 id 집합에 없던 새 id만 CREATE로 기록.
  // UPDATE/MOVE는 PATCH /nodes/:id(updateNode)에서, DELETE는 별도 핸들러에서 이미 기록된다.
  const prevIds = new Set(p.nodes.map((n) => n.id));
  for (const node of nodes) {
    if (!prevIds.has(node.id)) {
      prependActivity(p, {
        targetType: "NODE",
        targetId: node.id,
        targetLabel: node.title,
        action: "CREATE",
      });
    }
  }
  p.nodes = nodes;
  p.edges = edges;
  p.updatedAt = isoNow();
  persistShared();
  return p;
}

// 소프트 삭제 + 연결된 엣지 물리 삭제 (§CV-08 — 복구 시 엣지는 미복원 §CV-16)
export function softDeleteNode(
  projectId: string,
  nodeId: string,
): { id: string; deletedAt: string } | undefined {
  const p = findProject(projectId);
  if (!p) return undefined;
  const idx = p.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return undefined;
  const [node] = p.nodes.splice(idx, 1);
  const deletedAt = isoNow();
  p.trashedNodes.push({ ...node, deletedAt });
  p.edges = p.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
  p.updatedAt = deletedAt;
  prependActivity(p, { targetType: "NODE", targetId: node.id, targetLabel: node.title, action: "DELETE" });
  persistShared();
  return { id: nodeId, deletedAt };
}

export function restoreNode(
  projectId: string,
  nodeId: string,
): { id: string; deletedAt: null } | undefined {
  const p = findProject(projectId);
  if (!p) return undefined;
  const idx = p.trashedNodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return undefined;
  const [{ deletedAt: _deletedAt, ...node }] = p.trashedNodes.splice(idx, 1);
  p.nodes.push(node);
  p.updatedAt = isoNow();
  prependActivity(p, { targetType: "NODE", targetId: node.id, targetLabel: node.title, action: "RESTORE" });
  persistShared();
  return { id: nodeId, deletedAt: null };
}

export function purgeNode(projectId: string, nodeId: string): { id: string; purged: boolean } | undefined {
  const p = findProject(projectId);
  if (!p) return undefined;
  const idx = p.trashedNodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return { id: nodeId, purged: false };
  p.trashedNodes.splice(idx, 1);
  persistShared();
  return { id: nodeId, purged: true };
}

export function listTrashedNodes(
  projectId: string,
): (NodeDTO & { deletedAt: string })[] | undefined {
  const p = findProject(projectId);
  if (!p) return undefined;
  // BE 계약 변경(TrashNode에 markdown/position 추가, 요청 중) 선반영 — 새로고침 시
  // 휴지통 미리보기·위치가 유실되던 문제(§CV-16) 대응. 실제 BE 배포되면 형태 일치.
  return p.trashedNodes.map((n) => ({
    id: n.id,
    title: n.title,
    type: n.type,
    markdown: n.markdown,
    collapsed: n.collapsed,
    position: n.position,
    deletedAt: n.deletedAt,
    updatedAt: n.updatedAt,
  }));
}

export function addMessage(projectId: string, content: string): ChatMessageDTO | undefined {
  const p = findProject(projectId);
  if (!p) return undefined;
  const message: ChatMessageDTO = {
    id: uuid(),
    content,
    createdAt: isoNow(),
    user: currentUserRef(),
  };
  p.messages.push(message);
  persistShared();
  return message;
}

function prependActivity(
  p: ProjectRecord,
  partial: Pick<ActivityDTO, "targetType" | "targetId" | "targetLabel" | "action">,
): void {
  p.history.unshift({
    id: uuid(),
    createdAt: isoNow(),
    user: currentUserRef(),
    ...partial,
  });
}

/** 로그인/회원가입 시 입력 email로 데모 user를 갱신하고 토큰을 발급한다. */
export function loginAs(email: string, name?: string): { user: User; accessToken: string } {
  // 회원가입(name 있음)은 knownUsers에 등록해둔다. 로그인(name 없음)은 항상 이전
  // db.user.name(보통 시드 "데모 사용자")을 그대로 썼었다 — 그래서 어느 계정으로
  // 로그인해도 닉네임이 항상 "데모 사용자"였다. knownUsers에 가입 시 이름이 있으면
  // 그걸 쓰고, 전혀 모르는 이메일이면 그제서야 local-part로 폴백한다.
  if (name) db.knownUsers[email] = name;
  db.user = {
    ...db.user,
    email,
    name: name ?? db.knownUsers[email] ?? email.split("@")[0],
  };
  persistUser();
  persistShared();
  return { user: db.user, accessToken: issueToken(db.user.id) };
}

// ── Members 셀렉터·변이 ───────────────────────────────────────────────────────

export function getMembersForProject(projectId: string): Member[] {
  return db.members[projectId] ?? [];
}

/**
 * 멤버 초대. 이미 해당 projectId에 동일 email이 있으면 null 반환(중복).
 * 초대된 user는 email local-part를 name으로 즉석 생성.
 */
export function inviteMember(
  projectId: string,
  email: string,
  role: "EDITOR" | "VIEWER",
): Member | null {
  const list = db.members[projectId] ?? [];
  if (list.some((m) => m.email === email)) return null;
  const name = email.split("@")[0];
  const member: Member = { userId: uuid(), name, email, role };
  db.members[projectId] = [...list, member];
  persistShared();
  return member;
}

/**
 * 멤버 역할 변경. 해당 userId가 없거나 OWNER이면 undefined 반환.
 */
export function updateMemberRole(
  projectId: string,
  userId: string,
  role: "EDITOR" | "VIEWER",
): Member | undefined {
  const list = db.members[projectId] ?? [];
  const member = list.find((m) => m.userId === userId);
  if (!member) return undefined;
  if (member.role === "OWNER") return undefined;
  member.role = role;
  persistShared();
  return member;
}

/**
 * 멤버 제거. OWNER 제거 시도는 "OWNER" 문자열 반환(차단 신호).
 * 없는 userId이면 undefined 반환. 성공 시 제거된 userId 반환.
 */
export function removeMember(
  projectId: string,
  userId: string,
): string | "OWNER" | undefined {
  const list = db.members[projectId] ?? [];
  const idx = list.findIndex((m) => m.userId === userId);
  if (idx === -1) return undefined;
  if (list[idx].role === "OWNER") return "OWNER";
  db.members[projectId] = list.filter((_, i) => i !== idx);
  persistShared();
  return userId;
}

// ── OTP (mock 전용) ────────────────────────────────────────────────────────────
// 실서버는 verify된 이메일만 signup 허용. 목에서는 단순화 — signup은 별도 제약 없음.

/** 6자리 랜덤 숫자 코드를 생성해 db에 저장하고 반환한다. */
export function generateCode(email: string): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  db.verificationCodes[email] = code;
  return code;
}

/** 저장된 코드와 일치하면 true 반환 후 코드를 삭제(1회성). */
export function verifyCode(email: string, code: string): boolean {
  const stored = db.verificationCodes[email];
  if (stored === undefined || stored !== code) return false;
  delete db.verificationCodes[email];
  return true;
}
