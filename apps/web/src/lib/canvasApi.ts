// 캔버스 REST — apps/api/openapi.yaml `/projects/{projectId}/canvas` (GET/PUT)
import type { EdgeDTO, NodeDTO } from "@markflow/shared";

import { api } from "./api";

export interface CanvasSnapshotResponse {
  project: { id: string; name: string; role: string };
  nodes: NodeDTO[];
  edges: EdgeDTO[];
}

export interface CanvasSaveResponse {
  savedAt: string;
}

export async function fetchCanvas(projectId: string): Promise<CanvasSnapshotResponse> {
  const res = await api<CanvasSnapshotResponse>(`/projects/${projectId}/canvas`);
  if (!res) throw new Error("캔버스를 불러오지 못했습니다.");
  return res;
}

export async function saveCanvasSnapshot(
  projectId: string,
  payload: { nodes: NodeDTO[]; edges: EdgeDTO[] },
): Promise<CanvasSaveResponse> {
  const res = await api<CanvasSaveResponse>(`/projects/${projectId}/canvas`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res) throw new Error("캔버스를 저장하지 못했습니다.");
  return res;
}
