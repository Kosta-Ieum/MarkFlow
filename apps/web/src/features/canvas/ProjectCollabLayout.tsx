// 캔버스(/p/:projectId)와 노드 에디터(/p/:projectId/n/:nodeId)가 같은 소켓 연결을 공유하게
// 하는 레이아웃. 전엔 두 라우트가 형제라서 노드 에디터로 이동하면 CanvasPage가 unmount되며
// 소켓이 끊겼다 — 그 안에서 저장해도 다른 탭에 실시간으로 안 보이던 버그의 원인.
// connect/disconnect를 이 레이아웃으로 올려서 두 라우트를 오가도 연결이 유지되게 한다.
import { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";

import { useCollaboration } from "../../collab/useCollaboration";
import { setActiveCollab } from "../../store/canvasStore";
import { useCanvasSnapshot } from "../node-editor/useNodeEditor";

export function ProjectCollabLayout() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const collab = useCollaboration(projectId);
  // role을 먼저 알아야 연결 여부를 정할 수 있어 여기서도 캔버스 스냅샷을 조회한다
  // (CanvasPage/NodeEditorPage가 각자 또 로드하는 것과 별개 — react-query가 같은 키로 캐시 공유).
  const { data: snapshot } = useCanvasSnapshot(projectId);
  const role = snapshot?.project.role;

  useEffect(() => {
    if (!projectId) return;
    // role을 아직 모르면 대기(섣부른 연결 방지).
    // VIEWER도 다른 사용자의 움직임을 실시간으로 보기 위해 소켓 연결이 필요하므로 접속을 허용합니다.
    if (role === undefined) return;
    collab.connect(projectId);
    setActiveCollab(collab);
    return () => {
      setActiveCollab(null);
      collab.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, role]);

  return <Outlet />;
}
