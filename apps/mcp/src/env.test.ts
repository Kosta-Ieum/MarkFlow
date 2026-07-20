import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

const valid = {
  MARKFLOW_API_BASE: "https://api.example.com",
  MARKFLOW_BOT_EMAIL: "bot@example.com",
  MARKFLOW_BOT_PASSWORD: "s3cr3t-pass",
};

describe("parseEnv", () => {
  it("정상 env를 파싱한다", () => {
    const env = parseEnv(valid);
    expect(env.MARKFLOW_API_BASE).toBe(valid.MARKFLOW_API_BASE);
    expect(env.MARKFLOW_BOT_EMAIL).toBe(valid.MARKFLOW_BOT_EMAIL);
    expect(env.MARKFLOW_BOT_PASSWORD).toBe(valid.MARKFLOW_BOT_PASSWORD);
  });

  it("MARKFLOW_WS_URL 미설정 시 MARKFLOW_API_BASE로 폴백한다", () => {
    const env = parseEnv(valid);
    expect(env.MARKFLOW_WS_URL).toBe(valid.MARKFLOW_API_BASE);
  });

  it("MARKFLOW_WS_URL이 설정되면 그 값을 그대로 쓴다", () => {
    const env = parseEnv({ ...valid, MARKFLOW_WS_URL: "https://ws.example.com" });
    expect(env.MARKFLOW_WS_URL).toBe("https://ws.example.com");
  });

  it("누락된 변수명이 담긴 에러를 던진다", () => {
    const { MARKFLOW_API_BASE: _omit, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrowError(/MARKFLOW_API_BASE/);
  });

  it("여러 변수가 누락되면 전부 에러 메시지에 나열한다", () => {
    try {
      parseEnv({});
      expect.unreachable("빈 env는 실패해야 한다");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain("MARKFLOW_API_BASE");
      expect(message).toContain("MARKFLOW_BOT_EMAIL");
      expect(message).toContain("MARKFLOW_BOT_PASSWORD");
    }
  });

  it("형식이 잘못된 값(이메일 아님)도 필드명과 함께 에러를 던진다", () => {
    expect(() => parseEnv({ ...valid, MARKFLOW_BOT_EMAIL: "not-an-email" })).toThrowError(
      /MARKFLOW_BOT_EMAIL/,
    );
  });

  it("에러 메시지에 비밀값(비밀번호 등) 자체는 노출하지 않는다", () => {
    const secret = "super-secret-value-should-not-leak";
    try {
      parseEnv({ ...valid, MARKFLOW_API_BASE: "not-a-url", MARKFLOW_BOT_PASSWORD: secret });
      expect.unreachable("잘못된 API_BASE는 실패해야 한다");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(secret);
      expect(message).not.toContain(valid.MARKFLOW_BOT_EMAIL);
    }
  });
});
