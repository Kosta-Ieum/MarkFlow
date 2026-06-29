// 임시 시드 데이터 — 화면설계서 §4.4.2 "시드 흐름" 그대로.
// Zustand 캔버스 스토어(IEUM-23)가 들어오면 이 파일은 제거되고 실제 데이터로 대체된다.
import type { Edge, Node } from "@xyflow/react";
import type { MarkdownNodeData } from "./MarkdownNodeCard";

export const seedNodes: Node<MarkdownNodeData>[] = [
  {
    id: "seed-1",
    type: "markdown",
    position: { x: 0, y: 0 },
    data: { title: "킥오프", markdown: "# 킥오프\n프로젝트 시작 미팅", type: "idea", collapsed: true },
  },
  {
    id: "seed-2",
    type: "markdown",
    position: { x: 320, y: -120 },
    data: { title: "요구사항 정리", markdown: "## 요구사항\n- 캔버스\n- 실시간 협업", type: "doc", collapsed: true },
  },
  {
    id: "seed-3",
    type: "markdown",
    position: { x: 320, y: 120 },
    data: { title: "MVP 채팅 구현", markdown: "## TODO\n- [ ] 소켓 연결\n- [ ] 채팅 UI", type: "task", collapsed: true },
  },
  {
    id: "seed-4",
    type: "markdown",
    position: { x: 640, y: -120 },
    data: { title: "React Flow 채택?", markdown: "## 결정\nReact Flow 12 채택", type: "decision", collapsed: true },
  },
  {
    id: "seed-5",
    type: "markdown",
    position: { x: 640, y: 120 },
    data: { title: "노드 스키마", markdown: "## 데이터\n```ts\ninterface Node {\n  id: string\n}\n```", type: "data", collapsed: true },
  },
];

export const seedEdges: Edge[] = [
  { id: "seed-e1", source: "seed-1", target: "seed-2" },
  { id: "seed-e2", source: "seed-1", target: "seed-3" },
  { id: "seed-e3", source: "seed-2", target: "seed-4" },
  { id: "seed-e4", source: "seed-3", target: "seed-5" },
];
