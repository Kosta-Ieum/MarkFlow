// REST ErrorResponse · 소켓 ack error · fetch 자체 실패를 툴 결과 isError 텍스트로 변환한다. (R6)
import type { ErrorResponse } from "@markflow/shared";

const FORBIDDEN_HINT = "봇 계정이 이 프로젝트의 EDITOR 멤버인지 확인하세요";

/** 툴 결과 isError 텍스트로 변환되는 표준 에러 형태. */
export class McpToolError extends Error {
  readonly code: string;
  readonly hint?: string;

  constructor(code: string, message: string, hint?: string) {
    super(message);
    this.name = "McpToolError";
    this.code = code;
    this.hint = hint;
  }
}

/** "[코드] 메시지" + (있으면) 힌트 줄. */
export function formatMcpError(err: McpToolError): string {
  const base = `[${err.code}] ${err.message}`;
  return err.hint ? `${base}\n${err.hint}` : base;
}

/**
 * REST ErrorResponse → McpToolError. targetId를 넘기면 메시지에 대상 id를 덧붙인다
 * (NOT_FOUND 등 호출자가 대상을 아는 경우, R6.2). FORBIDDEN엔 EDITOR 확인 힌트 첨부(R6.1).
 */
export function mapErrorResponse(body: ErrorResponse, targetId?: string): McpToolError {
  const { code, message } = body.error;
  const fullMessage = targetId ? `${message} (${targetId})` : message;
  const hint = code === "FORBIDDEN" ? FORBIDDEN_HINT : undefined;
  return new McpToolError(code, fullMessage, hint);
}

/** 소켓 ack `{ok:false, error}` → McpToolError. error 형태는 ErrorResponse.error와 동일(design.md §2-5). */
export function mapAckError(error: { code: string; message: string }, targetId?: string): McpToolError {
  return mapErrorResponse({ error: { code: error.code, message: error.message, details: null } }, targetId);
}

/** fetch 자체 실패(네트워크 단절 등) — 인증 오류(UNAUTHORIZED)와 혼동되지 않도록 별도 코드로 구분(R6.3). */
export function mapNetworkError(err: unknown): McpToolError {
  const message = err instanceof Error ? err.message : String(err);
  return new McpToolError("NETWORK", `네트워크 오류: ${message}`);
}
