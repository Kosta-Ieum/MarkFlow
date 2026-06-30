// 캔버스 REST — apps/api/openapi.yaml `/projects/{projectId}/canvas`·`/nodes/...` 정본
import type { EdgeDTO, NodeDTO, NodeType, XY } from "@markflow/shared";

import { api } from "./api";

export interface CanvasSnapshotResponse {
  project: { id: string; name: string; role: string };
  nodes: NodeDTO[];
  edges: EdgeDTO[];
}

export interface CanvasSaveResponse {
  savedAt: string;
}

async function unwrap<T>(promise: Promise<T | null>, errorMessage: string): Promise<T> {
  const res = await promise;
  if (!res) throw new Error(errorMessage);
  return res;
}

export function fetchCanvas(projectId: string): Promise<CanvasSnapshotResponse> {
  return unwrap(api<CanvasSnapshotResponse>(`/projects/${projectId}/canvas`), "캔버스를 불러오지 못했습니다.");
}

export function saveCanvasSnapshot(
  projectId: string,
  payload: { nodes: NodeDTO[]; edges: EdgeDTO[] },
): Promise<CanvasSaveResponse> {
  return unwrap(
    api<CanvasSaveResponse>(`/projects/${projectId}/canvas`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
    "캔버스를 저장하지 못했습니다.",
  );
}

// --- 휴지통 (§CV-16 — 노드 소프트삭제/복구/영구삭제) ---

// markdown/position은 BE 계약 변경 요청 중(TrashNode 확장) — 추가 전 응답에서는 undefined일 수
// 있어 옵셔널로 둔다. canvasStore의 fromTrashNodeDTO가 누락 시 빈 값으로 채워 화면이 깨지지 않게 한다.
export interface TrashNode {
  id: string;
  title: string;
  type: NodeType;
  markdown?: string;
  position?: XY;
  deletedAt: string;
}

export function deleteNode(projectId: string, nodeId: string): Promise<{ id: string; deletedAt: string }> {
  return unwrap(
    api(`/projects/${projectId}/nodes/${nodeId}`, { method: "DELETE" }),
    "노드를 삭제하지 못했습니다.",
  );
}

export function restoreNode(projectId: string, nodeId: string): Promise<{ id: string; deletedAt: string | null }> {
  return unwrap(
    api(`/projects/${projectId}/nodes/${nodeId}/restore`, { method: "POST" }),
    "노드를 복구하지 못했습니다.",
  );
}

export function purgeNode(projectId: string, nodeId: string): Promise<{ id: string; purged: boolean }> {
  return unwrap(
    api(`/projects/${projectId}/nodes/${nodeId}/permanent`, { method: "DELETE" }),
    "노드를 영구삭제하지 못했습니다.",
  );
}

export function fetchTrash(projectId: string): Promise<{ nodes: TrashNode[] }> {
  return unwrap(api(`/projects/${projectId}/trash`), "휴지통 목록을 불러오지 못했습니다.");
}
