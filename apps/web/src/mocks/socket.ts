// 로컬 멀티탭 동기화 검증용 가짜 Socket — VITE_MOCK_API=1일 때만 쓰인다.
// BE의 canvas.gateway.ts가 아직 TODO 스텁이라 실제 서버가 없다. 같은 브라우저의 다른 탭에
// 이벤트를 BroadcastChannel로 릴레이만 해서 멀티커서/소프트락 UI를 BE 없이 시각 확인하기 위한 용도.
// 실제 Socket.io 프로토콜이 아니고, 서버 권한 재검사·영속화도 없다 — 데모/검증 전용, 정본 아님.
import { useAuthStore } from "../store/authStore";
import { SOCKET_EVENTS } from "@markflow/shared";
import { addMessage } from "./db";

type Handler = (payload: any) => void;
type WireMessage = { senderId: string; event: string; payload: any };

const CHANNEL_NAME = "markflow-mock-socket";

// nodeId -> 현재 락 보유자 userId. 모듈 스코프(탭 전체 공유)로 둬서, 소켓 인스턴스가
// 재생성돼도(예전엔 라우트 이동마다 재생성됐다) 알고 있던 락 상태가 안 날아간다.
// emit(lockAcquire)가 이미 다른 사람이 들고 있는 락을 무조건 덮어쓰던 게 "두 계정이 동시에
// 같은 노드를 편집할 수 있던" 버그의 직접 원인이었다 — 여기서 한 번 더 막는다.
const lockTable = new Map<string, string>();

export function createMockSocket() {
  const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const handlers = new Map<string, Set<Handler>>();
  const roster = new Map<string, string>(); // userId -> name (다른 탭들, 나 자신은 제외)
  let projectId: string | null = null;

  const me = () => useAuthStore.getState().user;

  const dispatch = (event: string, payload: any) => {
    if (event === SOCKET_EVENTS.lockUpdate) {
      if (payload.userId) lockTable.set(payload.nodeId, payload.userId);
      else lockTable.delete(payload.nodeId);
    }
    handlers.get(event)?.forEach((h) => h(payload));
  };

  const send = (event: string, payload: any) => {
    channel.postMessage({ senderId: instanceId, event, payload } satisfies WireMessage);
  };

  const rosterAsList = () => {
    const self = me();
    const list = [...roster.entries()].map(([id, name]) => ({ id, name }));
    if (self) list.unshift({ id: self.id, name: self.name });
    return list;
  };

  const broadcastPresence = () => dispatch(SOCKET_EVENTS.presenceUpdate, { users: rosterAsList() });

  channel.onmessage = (e: MessageEvent<WireMessage>) => {
    const msg = e.data;
    if (msg.senderId === instanceId) return;

    if (msg.event === "__presence_request__" || msg.event === "__presence_announce__") {
      if (msg.payload.projectId !== projectId) return;
      if (msg.event === "__presence_request__") {
        send("__presence_announce__", { projectId, userId: me()?.id, name: me()?.name });
      }
      if (msg.payload.userId) roster.set(msg.payload.userId, msg.payload.name);
      broadcastPresence();
      return;
    }

    if (msg.event === "__presence_leave__") {
      if (msg.payload.projectId !== projectId) return;
      roster.delete(msg.payload.userId);
      broadcastPresence();
      return;
    }

    // node/edge/chat/cursor 등 — 그대로 다른 탭의 store에 적용.
    dispatch(msg.event, msg.payload);
  };

  return {
    on(event: string, handler: Handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    },
    off(event: string, handler: Handler) {
      handlers.get(event)?.delete(handler);
    },
    emit(event: string, payload: any = {}) {
      switch (event) {
        case SOCKET_EVENTS.syncJoin: {
          projectId = payload.projectId;
          roster.clear();
          send("__presence_request__", { projectId });
          broadcastPresence();
          return;
        }
        case SOCKET_EVENTS.lockAcquire: {
          const myId = me()?.id;
          const holder = lockTable.get(payload.nodeId);
          if (holder && holder !== myId) return; // 이미 다른 사람이 들고 있으면 거부.
          dispatch(SOCKET_EVENTS.lockUpdate, { nodeId: payload.nodeId, userId: myId ?? null });
          send(SOCKET_EVENTS.lockUpdate, { nodeId: payload.nodeId, userId: myId ?? null });
          return;
        }
        case SOCKET_EVENTS.lockRelease: {
          const myId = me()?.id;
          // 내가 들고 있던 락만 해제 — 이미 다른 사람 걸로 넘어갔으면 건드리지 않는다.
          if (lockTable.get(payload.nodeId) !== myId) return;
          dispatch(SOCKET_EVENTS.lockUpdate, { nodeId: payload.nodeId, userId: null });
          send(SOCKET_EVENTS.lockUpdate, { nodeId: payload.nodeId, userId: null });
          return;
        }
        case SOCKET_EVENTS.chatMessage: {
          // 실서버는 service로 영속화 후 chat:new로 브로드캐스트한다 — db.ts의 addMessage가
          // 같은 역할(메시지 기록 + id/createdAt/작성자 부여 + 탭 간 persist)을 대신한다.
          const message = addMessage(payload.projectId, payload.content);
          if (!message) return;
          dispatch(SOCKET_EVENTS.chatNew, { message });
          send(SOCKET_EVENTS.chatNew, { message });
          return;
        }
        default:
          // cursor:move·node:*·edge:* 등은 그대로 다른 탭에 릴레이.
          send(event, payload);
      }
    },
    disconnect() {
      if (projectId) send("__presence_leave__", { projectId, userId: me()?.id });
      channel.close();
      handlers.clear();
    },
  };
}
