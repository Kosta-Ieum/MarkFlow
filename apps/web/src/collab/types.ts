// CollabAPI 보조 타입.
// 캔버스 변경 페이로드(NodeChange/EdgeChange)는 F1 캔버스 도메인 타입이라 아직 미확정.
// chat/cursor 등 F2가 소비하는 타입은 @markflow/shared로 정확히 받는다(이 파일에 재정의 금지).
export type NodeChange = unknown; // TODO(IEUM-34): F1 캔버스 노드 변경 타입 확정
export type EdgeChange = unknown; // TODO(IEUM-34): F1 캔버스 엣지 변경 타입 확정
