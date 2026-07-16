// Socket.io-client 단일 인스턴스 생성.
// VITE_MOCK_API=1이면 실서버 대신 mocks/socket.ts의 BroadcastChannel mock으로 대체한다 —
// BE의 canvas.gateway.ts가 TODO 스텁인 동안 로컬 멀티탭 동기화를 시각 확인하기 위한 임시 우회.
// 플래그 없으면 정본대로 실제 Socket.io 서버에 연결한다.
import { io, type Socket } from "socket.io-client";
import { createMockSocket } from "../mocks/socket";

export function createSocket(url: string, opts: Parameters<typeof io>[1]): Socket {
  if (import.meta.env.VITE_MOCK_API === "1") {
    return createMockSocket() as unknown as Socket;
  }
  // 빈 문자열이면 socket.io-client가 현재 페이지 origin으로 연결한다(same-origin 프록시용).
  return io(url || undefined, opts);
}
