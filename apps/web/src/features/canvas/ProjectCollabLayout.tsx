// 캔버스(/p/:projectId)와 노드 에디터(/p/:projectId/n/:nodeId)가 같은 소켓 연결을 공유하게
// 하는 레이아웃. 전엔 두 라우트가 형제라서 노드 에디터로 이동하면 CanvasPage가 unmount되며
// 소켓이 끊겼다 — 그 안에서 저장해도 다른 탭에 실시간으로 안 보이던 버그의 원인.
// connect/disconnect를 이 레이아웃으로 올려서 두 라우트를 오가도 연결이 유지되게 한다.
import { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";

import { useCollaboration } from "../../collab/useCollaboration";
import { setActiveCollab } from "../../store/canvasStore";

export function ProjectCollabLayout() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const collab = useCollaboration(projectId);

  useEffect(() => {
    if (!projectId) return;
    collab.connect(projectId);
    setActiveCollab(collab);
    return () => {
      setActiveCollab(null);
      collab.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return <Outlet />;
}
