// Socket.io 구현 (정본) — IEUM-34 [F1-3.1]
// .claude/rules/realtime.md: 연결 1개·룸 1개(project:<id>), 이벤트명은 SOCKET_EVENTS만 사용.
// 커서·소프트락은 in-memory(presenceStore), 노드/엣지/채팅 수신은 store에 적용만(재emit 금지).
import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@markflow/shared";
import type { CanvasSnapshot, ChatMessageDTO, EdgeDTO, NodeDTO, XY } from "@markflow/shared";

import { createSocket } from "../lib/socket";
import { useAuthStore } from "../store/authStore";
import { useCanvasStore, fromNodeDTO } from "../store/canvasStore";
import { useChatStore } from "../store/chatStore";
import { usePresenceStore } from "../store/presenceStore";
import type { CollabAPI } from "./CollabAPI";

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? "http://localhost:4000";
const CURSOR_THROTTLE_MS = 50; // .claude/rules/frontend.md: 커서 throttle ≈50ms

// presence:update · lock:update는 packages/shared/src/socket.ts에 payload schema가 아직
// 없다(계약 공백 — BE가 SocketPayloadSchemas에 채우면 이 타입은 import로 교체).
interface PresenceUpdatePayload {
  users: { id: string; name: string }[];
}
interface LockUpdatePayload {
  nodeId: string;
  userId: string | null;
}

export function useSocketCollab(projectId: string): CollabAPI {
  const socketRef = useRef<Socket | null>(null);
  const lastCursorAtRef = useRef(0);
  const lockedNodeIdRef = useRef<string | null>(null);
  const unloadHandlerRef = useRef<(() => void) | null>(null);

  const teardownUnloadHandler = () => {
    if (unloadHandlerRef.current) {
      window.removeEventListener("pagehide", unloadHandlerRef.current);
      unloadHandlerRef.current = null;
    }
  };

  // 컴포넌트가 사라지면 무조건 정리 — connect()를 안 불렀어도 안전.
  useEffect(() => {
    return () => {
      teardownUnloadHandler();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const connect: CollabAPI["connect"] = (pid) => {
    if (socketRef.current) return;
    const token = useAuthStore.getState().token;
    const socket = createSocket(WS_URL, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.emit(SOCKET_EVENTS.syncJoin, { projectId: pid });

    // 노드 편집 중 탭을 그냥 닫거나 새로고침하면(라우트 이동이 아니라 페이지 이탈) React
    // 언마운트 클린업이 못 돌아 소프트락이 그 사람 걸로 영원히 남는다 — pagehide는 탭이
    // 닫히거나 다른 페이지로 이동할 때 신뢰성 있게 발생하므로, 여기서 마지막으로
    // 락 해제 + 연결 종료(퇴장 알림)를 강제로 내보낸다.
    const handlePageHide = () => {
      if (lockedNodeIdRef.current) {
        socket.emit(SOCKET_EVENTS.lockRelease, { projectId: pid, nodeId: lockedNodeIdRef.current });
        lockedNodeIdRef.current = null;
      }
      socket.disconnect();
    };
    teardownUnloadHandler();
    window.addEventListener("pagehide", handlePageHide);
    unloadHandlerRef.current = handlePageHide;

    const applySnapshot = (snapshot: CanvasSnapshot) => {
      useCanvasStore.getState().applyRemoteSnapshot(snapshot.nodes, snapshot.edges);
    };
    socket.on(SOCKET_EVENTS.syncInit, applySnapshot);
    socket.on(SOCKET_EVENTS.syncResync, applySnapshot);

    socket.on(SOCKET_EVENTS.nodeAdd, ({ node }: { node: NodeDTO }) => {
      useCanvasStore.getState().applyRemoteAddNode(fromNodeDTO(node));
    });
    socket.on(SOCKET_EVENTS.nodeUpdate, ({ node }: { node: Partial<NodeDTO> & { id: string } }) => {
      const { id, position, ...patch } = node;
      useCanvasStore.getState().applyRemoteUpdateNode(id, patch, position);
    });
    socket.on(SOCKET_EVENTS.nodeDelete, ({ nodeId }: { nodeId: string }) => {
      useCanvasStore.getState().applyRemoteDeleteNode(nodeId);
    });
    socket.on(SOCKET_EVENTS.edgeAdd, ({ edge }: { edge: EdgeDTO }) => {
      useCanvasStore.getState().applyRemoteAddEdge(edge);
    });
    socket.on(SOCKET_EVENTS.edgeDelete, ({ edgeId }: { edgeId: string }) => {
      useCanvasStore.getState().applyRemoteDeleteEdge(edgeId);
    });

    socket.on(SOCKET_EVENTS.cursorMove, ({ userId, position }: { userId: string; position: XY }) => {
      if (userId === useAuthStore.getState().user?.id) return; // 내 커서 echo 무시
      usePresenceStore.getState().upsertCursor(userId, position);
    });
    socket.on(SOCKET_EVENTS.presenceUpdate, (payload: PresenceUpdatePayload) => {
      usePresenceStore.getState().setOnlineUsers(payload.users);
      // 나간 사람의 커서·락이 화면에 그대로 남던 문제 — 접속자 명단이 갱신될 때마다
      // 이제 명단에 없는 유저의 잔여 커서/락을 정리한다(정상 퇴장이든 비정상 종료든 동일하게 적용).
      usePresenceStore.getState().pruneOffline(payload.users.map((u) => u.id));
    });
    socket.on(SOCKET_EVENTS.lockUpdate, (payload: LockUpdatePayload) => {
      usePresenceStore.getState().setLock(payload.nodeId, payload.userId);
    });

    socket.on(SOCKET_EVENTS.chatNew, ({ message }: { message: ChatMessageDTO }) => {
      useChatStore.getState().applyRemoteMessage(message);
    });

    socket.on("disconnect", () => {
      usePresenceStore.getState().clear();
    });
  };

  const disconnect: CollabAPI["disconnect"] = () => {
    teardownUnloadHandler();
    socketRef.current?.disconnect();
    socketRef.current = null;
    usePresenceStore.getState().clear();
  };

  const emitCursor: CollabAPI["emitCursor"] = (p) => {
    const socket = socketRef.current;
    const userId = useAuthStore.getState().user?.id;
    if (!socket || !userId) return;
    const now = Date.now();
    if (now - lastCursorAtRef.current < CURSOR_THROTTLE_MS) return;
    lastCursorAtRef.current = now;
    socket.emit(SOCKET_EVENTS.cursorMove, { projectId, userId, position: p });
  };

  const emitLock: CollabAPI["emitLock"] = (nodeId) => {
    const socket = socketRef.current;
    if (!socket) return;
    if (nodeId) {
      socket.emit(SOCKET_EVENTS.lockAcquire, { projectId, nodeId });
      lockedNodeIdRef.current = nodeId;
    } else if (lockedNodeIdRef.current) {
      socket.emit(SOCKET_EVENTS.lockRelease, { projectId, nodeId: lockedNodeIdRef.current });
      lockedNodeIdRef.current = null;
    }
  };

  const sendChat: CollabAPI["sendChat"] = (content) => {
    socketRef.current?.emit(SOCKET_EVENTS.chatMessage, { projectId, content });
  };

  const emitNode: CollabAPI["emitNode"] = (c) => {
    const socket = socketRef.current;
    if (!socket) return;
    if (c.type === "add") socket.emit(SOCKET_EVENTS.nodeAdd, { projectId, node: c.node });
    else if (c.type === "update") socket.emit(SOCKET_EVENTS.nodeUpdate, { projectId, node: c.node });
    else socket.emit(SOCKET_EVENTS.nodeDelete, { projectId, nodeId: c.nodeId });
  };

  const emitEdge: CollabAPI["emitEdge"] = (c) => {
    const socket = socketRef.current;
    if (!socket) return;
    if (c.type === "add") socket.emit(SOCKET_EVENTS.edgeAdd, { projectId, edge: c.edge });
    else socket.emit(SOCKET_EVENTS.edgeDelete, { projectId, edgeId: c.edgeId });
  };

  return { connect, disconnect, emitCursor, emitLock, sendChat, emitNode, emitEdge };
}
