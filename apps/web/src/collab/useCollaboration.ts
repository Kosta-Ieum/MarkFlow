// CollabAPI 구현체 선택 훅 — 이 훅이 CollabAPI 정본 구현 자리다(Docs/07-Frontend-Architecture.md §4).
// 정본 전송은 Socket.io 직접 구현. 지금은 동작하는 최소 placeholder만 둔다.
// TODO(IEUM-34): Socket.io 배선(useSocketCollab) — connect/disconnect/emit* 실배선.
import { useMemo } from "react";
import type { ChatMessageDTO, XY } from "@markflow/shared";

import { api } from "../lib/api";
import { useChatStore } from "../store/chatStore";
import type { CollabAPI } from "./CollabAPI";
import type { EdgeChange, NodeChange } from "./types";

export function useCollaboration(projectId: string): CollabAPI {
  return useMemo<CollabAPI>(
    () => ({
      // TODO(IEUM-34): Socket.io 룸(project:<id>) 입장/퇴장.
      connect: (_projectId: string) => {
        // no-op (placeholder)
      },
      disconnect: () => {
        // no-op (placeholder)
      },
      // TODO(IEUM-34): cursor:move emit (throttle ≈50ms).
      emitCursor: (_p: XY) => {
        // no-op (placeholder)
      },
      // TODO(IEUM-34): lock:acquire / lock:release emit.
      emitLock: (_nodeId: string | null) => {
        // no-op (placeholder)
      },
      // 채팅 전송: 지금은 REST POST 후 결과를 store에 낙관 반영.
      // TODO(IEUM-34): 소켓 배선 후엔 chat:new broadcast 수신으로 일원화.
      sendChat: (content: string) => {
        void api<ChatMessageDTO>(`/projects/${projectId}/messages`, {
          method: "POST",
          body: JSON.stringify({ content }),
        }).then((msg) => {
          if (msg) useChatStore.getState().applyRemoteMessage(msg);
        });
      },
      // TODO(IEUM-34): node:add/update/delete emit.
      emitNode: (_c: NodeChange) => {
        // no-op (placeholder)
      },
      // TODO(IEUM-34): edge:add/delete emit.
      emitEdge: (_c: EdgeChange) => {
        // no-op (placeholder)
      },
    }),
    [projectId],
  );
}
