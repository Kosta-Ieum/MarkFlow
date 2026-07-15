// Socket 계약 단위 테스트 — socket.ts (SOCKET_EVENTS·roomOf·payload zod).
import { describe, it, expect } from "vitest";
import { SOCKET_EVENTS, roomOf, SocketPayloadSchemas } from "./socket";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("roomOf", () => {
  it("projectId를 project:<id> 룸으로 만든다", () => {
    expect(roomOf("abc")).toBe("project:abc");
    expect(roomOf(UUID)).toBe(`project:${UUID}`);
  });
});

describe("SOCKET_EVENTS", () => {
  it("이벤트명이 계약값과 일치한다", () => {
    expect(SOCKET_EVENTS.syncJoin).toBe("sync:join");
    expect(SOCKET_EVENTS.nodeAdd).toBe("node:add");
    expect(SOCKET_EVENTS.chatNew).toBe("chat:new");
  });

  it("이벤트 문자열에 중복이 없다", () => {
    const values = Object.values(SOCKET_EVENTS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("SocketPayloadSchemas", () => {
  it("모든 payload 키는 유효한 SOCKET_EVENTS 값이다", () => {
    const events = new Set<string>(Object.values(SOCKET_EVENTS));
    for (const key of Object.keys(SocketPayloadSchemas)) {
      expect(events.has(key)).toBe(true);
    }
  });

  it("node:update는 부분 노드를 허용하되 id는 필수다", () => {
    const schema = SocketPayloadSchemas[SOCKET_EVENTS.nodeUpdate];
    expect(schema.safeParse({ projectId: UUID, node: { id: UUID, title: "new" } }).success).toBe(true);
    expect(schema.safeParse({ projectId: UUID, node: { title: "new" } }).success).toBe(false);
  });

  it("chat:message는 빈 content를 거부한다", () => {
    const schema = SocketPayloadSchemas[SOCKET_EVENTS.chatMessage];
    expect(schema.safeParse({ projectId: UUID, content: "hi" }).success).toBe(true);
    expect(schema.safeParse({ projectId: UUID, content: "" }).success).toBe(false);
  });

  it("cursor:move는 position과 uuid를 검증한다", () => {
    const schema = SocketPayloadSchemas[SOCKET_EVENTS.cursorMove];
    expect(schema.safeParse({ projectId: UUID, userId: UUID, position: { x: 0, y: 0 } }).success).toBe(true);
    expect(schema.safeParse({ projectId: UUID, userId: UUID, position: { x: 0 } }).success).toBe(false);
  });

  it("presence:update는 {id,name} 유저 목록을 검증한다", () => {
    const schema = SocketPayloadSchemas[SOCKET_EVENTS.presenceUpdate];
    expect(schema.safeParse({ users: [{ id: UUID, name: "임민규" }] }).success).toBe(true);
    expect(schema.safeParse({ users: [{ id: UUID }] }).success).toBe(false);
    expect(schema.safeParse({ users: [] }).success).toBe(true);
  });
});
