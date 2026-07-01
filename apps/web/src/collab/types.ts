// CollabAPI 보조 타입 — IEUM-34 [F1-3.1]에서 확정.
// chat/cursor 등 F2가 소비하는 타입은 @markflow/shared로 정확히 받는다(이 파일에 재정의 금지).
import type { EdgeDTO, NodeDTO } from "@markflow/shared";

export type NodeChange =
  | { type: "add"; node: NodeDTO }
  | { type: "update"; node: Partial<NodeDTO> & { id: string } }
  | { type: "delete"; nodeId: string };

export type EdgeChange =
  | { type: "add"; edge: EdgeDTO }
  | { type: "delete"; edgeId: string };
