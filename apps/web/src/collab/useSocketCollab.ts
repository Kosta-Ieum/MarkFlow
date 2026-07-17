// Socket.io 구현 (정본) — IEUM-34 [F1-3.1]
// .claude/rules/realtime.md: 연결 1개·룸 1개(project:<id>), 이벤트명은 SOCKET_EVENTS만 사용.
// 커서·소프트락은 in-memory(presenceStore), 노드/엣지/채팅 수신은 store에 적용만(재emit 금지).
import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@markflow/shared";
import type { CanvasSnapshot, ChatMessageDTO, EdgeDTO, NodeDTO, UserRef, XY } from "@markflow/shared";

import { createSocket } from "../lib/socket";
import { queryClient } from "../lib/queryClient";
import { queryKeys } from "../lib/queryKeys";
import { useAuthStore } from "../store/authStore";
import { useCanvasStore, fromNodeDTO } from "../store/canvasStore";
import { useChatStore } from "../store/chatStore";
import { usePresenceStore } from "../store/presenceStore";
import type { CollabAPI } from "./CollabAPI";

// REST(lib/api.ts)와 동일 패턴: 프록시(로컬 Vite, 배포 Nginx)를 타도록 same-origin 연결.
// 절대 주소(Railway 등)로 직접 연결하면 브라우저가 소켓도 cross-site로 취급해 핸드셰이크가
// 막힐 수 있다 — REST는 이미 이 방식으로 고쳤는데 소켓은 누락돼 있었다.
const WS_URL = "";
const CURSOR_THROTTLE_MS = 50; // .claude/rules/frontend.md: 커서 throttle ≈50ms

// presence:update payload는 shared 계약(socket.ts)의 UserRefSchema(id/name/nickname?) 배열.
// nickname은 커서·접속자 표기에 쓰인다(표시는 nickname ?? name). lock:update는 아직 shared에
// payload schema가 없어 로컬 정의를 유지한다(BE가 채우면 import로 교체).
interface PresenceUpdatePayload {
  users: UserRef[];
}
interface LockUpdatePayload {
  nodeId: string;
  userId: string | null;
}

// 히스토리는 아직 전용 실시간 이벤트가 없다(SOCKET_EVENTS에 activity 관련 이벤트 자체가
// 없음) — 대신 구조적 변경(생성·삭제·복원·연결)이 일어난 이 이벤트들에 편승해 history
// 쿼리를 무효화한다. 새로고침 없이도 다음 조회 시 최신 로그를 받아오게 된다.
function invalidateHistory(projectId: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.history(projectId) });
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
      invalidateHistory(projectId);
    });
    socket.on(SOCKET_EVENTS.nodeUpdate, ({ node }: { node: Partial<NodeDTO> & { id: string } }) => {
      const { id, position, ...patch } = node;
      useCanvasStore.getState().applyRemoteUpdateNode(id, patch, position);
      // 순수 위치 이동(드래그마다 발생 — 너무 잦음)은 히스토리 라벨과 무관해 제외하고,
      // 제목·마크다운 등 실제 내용이 바뀐 경우(patch에 position 외 필드가 있을 때)만
      // 무효화한다 — 전에는 nodeUpdate를 통째로 제외해서 "수정" 기록이 실시간으로 반영 안 됐다.
      if (Object.keys(patch).length > 0) invalidateHistory(projectId);
    });
    socket.on(SOCKET_EVENTS.nodeDelete, ({ nodeId }: { nodeId: string }) => {
      useCanvasStore.getState().applyRemoteDeleteNode(nodeId);
      invalidateHistory(projectId);
    });
    socket.on(SOCKET_EVENTS.edgeAdd, ({ edge }: { edge: EdgeDTO }) => {
      useCanvasStore.getState().applyRemoteAddEdge(edge);
      invalidateHistory(projectId);
    });
    socket.on(SOCKET_EVENTS.edgeDelete, ({ edgeId }: { edgeId: string }) => {
      useCanvasStore.getState().applyRemoteDeleteEdge(edgeId);
      invalidateHistory(projectId);
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

    socket.on("disconnect", (reason) => {
      console.log("🚨 소켓 끊김 원인:", reason); // 개발자 도구 콘솔 확인용

      // 서버가 킥오프 시킨 경우(권한 변경, 강퇴 등)
      if (reason === "io server disconnect") {
        alert("프로젝트 권한이 변경되어 새로고침합니다.");
        window.location.reload();
      }

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

  // ack 콜백 없이 fire-and-forget으로 보내면, 서버 검증/권한 실패로 브로드캐스트가
  // 아예 안 나가도(내 화면은 이미 낙관적으로 지워진 상태라) 아무 신호 없이 조용히
  // 묻혀서 "다른 화면엔 실시간 반영이 안 된다"는 버그가 원인 불명으로 남는다 — 최소한
  // 콘솔에는 남겨서 디버깅 가능하게 한다.
  const logAckFailure = (event: string) => (ack?: { ok: boolean; error?: { code: string; message: string } }) => {
    if (ack && !ack.ok) {
      console.warn(`[collab] ${event} 처리 실패 — 다른 화면에 반영 안 됐을 수 있음:`, ack.error);
    }
  };

  const emitEdge: CollabAPI["emitEdge"] = (c) => {
    const socket = socketRef.current;
    if (!socket) return;
    if (c.type === "add") {
      // BE가 엣지 생성 시 클라이언트가 보낸 id를 무시하고 자체 id를 새로 발급한다 —
      // ack로 돌아온 진짜 id로 로컬 임시 id를 맞춰주지 않으면, 생성한 본인만 잘못된 id를
      // 계속 들고 있다가 나중에 그 엣지를 삭제하려 할 때 서버가 NOT_FOUND로 거부한다.
      socket.emit(
        SOCKET_EVENTS.edgeAdd,
        { projectId, edge: c.edge },
        (ack?: { ok: boolean; data?: { edge: EdgeDTO }; error?: { code: string; message: string } }) => {
          if (ack?.ok && ack.data?.edge) {
            useCanvasStore.getState().reconcileEdgeId(c.edge.id, ack.data.edge);
            invalidateHistory(projectId);
          } else if (ack && !ack.ok) {
            console.warn(`[collab] ${SOCKET_EVENTS.edgeAdd} 처리 실패 — 다른 화면에 반영 안 됐을 수 있음:`, ack.error);
          }
        },
      );
    } else {
      socket.emit(
        SOCKET_EVENTS.edgeDelete,
        { projectId, edgeId: c.edgeId },
        (ack?: { ok: boolean; error?: { code: string; message: string } }) => {
          logAckFailure(SOCKET_EVENTS.edgeDelete)(ack);
          if (ack?.ok) invalidateHistory(projectId);
        },
      );
    }
  };

  return { connect, disconnect, emitCursor, emitLock, sendChat, emitNode, emitEdge };
}
