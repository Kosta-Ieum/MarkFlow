// 봇 계정 인증 수명주기 — login/refresh, Set-Cookie 파싱·보관, 401 복구. (R2)
import { AuthResponseSchema, RefreshResponseSchema, type LoginRequest } from "@markflow/shared";
import type { Env } from "./env.js";
import { McpToolError } from "./errors.js";

const REFRESH_COOKIE_NAME = "refresh_token";

export interface AuthManagerOptions {
  /** login 성공 시 호출되는 훅 — 소켓 재접속 연쇄용(T4, design.md 제약 2). 지금은 훅만 노출. */
  onLogin?: (accessToken: string) => void;
}

/** Set-Cookie 헤더들에서 refresh_token 쿠키 값을 추출한다. 없으면 null. */
function extractRefreshCookie(res: Response): string | null {
  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() === REFRESH_COOKIE_NAME) {
      return pair.slice(eq + 1).trim();
    }
  }
  return null;
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class AuthManager {
  private accessToken: string | null = null;
  private refreshCookie: string | null = null;
  private pendingRecovery: Promise<string> | null = null;

  constructor(
    private readonly env: Env,
    private readonly options: AuthManagerOptions = {},
  ) {}

  /** 토큰이 있으면 즉시 반환, 없으면 login으로 발급받는다. */
  async ensureToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    return this.login();
  }

  /**
   * 401 수신 시 호출한다: refresh 시도 → 실패(409 포함)하면 login 폴백 → 둘 다 실패하면
   * McpToolError(AUTH_FAILED)를 던지고 끝낸다(무한 재시도 금지, R2.3). 동시 호출은 진행 중인
   * promise 하나로 합친다(apps/web/src/lib/api.ts의 refreshPromise 패턴).
   */
  async handleUnauthorized(): Promise<string> {
    if (!this.pendingRecovery) {
      this.pendingRecovery = this.recover().finally(() => {
        this.pendingRecovery = null;
      });
    }
    return this.pendingRecovery;
  }

  private async recover(): Promise<string> {
    if (this.refreshCookie) {
      try {
        return await this.refresh();
      } catch {
        // refresh 실패(만료·409·네트워크 등) → login 폴백으로 계속 진행.
      }
    }
    try {
      return await this.login();
    } catch (err) {
      throw new McpToolError("AUTH_FAILED", `인증 복구에 실패했습니다: ${toMessage(err)}`);
    }
  }

  private async login(): Promise<string> {
    const body: LoginRequest = {
      email: this.env.MARKFLOW_BOT_EMAIL,
      password: this.env.MARKFLOW_BOT_PASSWORD,
    };
    let res: Response;
    try {
      res = await fetch(`${this.env.MARKFLOW_API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new McpToolError("NETWORK", `로그인 요청 실패: ${toMessage(err)}`);
    }
    if (!res.ok) {
      throw new McpToolError("UNAUTHORIZED", `로그인 실패 (HTTP ${res.status})`);
    }
    const parsed = AuthResponseSchema.parse(await res.json());
    this.accessToken = parsed.accessToken;
    this.refreshCookie = extractRefreshCookie(res) ?? this.refreshCookie;
    this.options.onLogin?.(parsed.accessToken);
    return parsed.accessToken;
  }

  private async refresh(): Promise<string> {
    if (!this.refreshCookie) {
      throw new McpToolError("UNAUTHORIZED", "리프레시 토큰이 없습니다");
    }
    let res: Response;
    try {
      res = await fetch(`${this.env.MARKFLOW_API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { Cookie: `${REFRESH_COOKIE_NAME}=${this.refreshCookie}` },
      });
    } catch (err) {
      throw new McpToolError("NETWORK", `리프레시 요청 실패: ${toMessage(err)}`);
    }
    if (!res.ok) {
      // 409 = 다른 기기 로그인으로 세션 만료(auth.service.ts refresh()) — 재사용 불가, 폐기.
      if (res.status === 409) this.refreshCookie = null;
      throw new McpToolError("UNAUTHORIZED", `리프레시 실패 (HTTP ${res.status})`);
    }
    const parsed = RefreshResponseSchema.parse(await res.json());
    this.accessToken = parsed.accessToken;
    this.refreshCookie = extractRefreshCookie(res) ?? this.refreshCookie;
    return parsed.accessToken;
  }
}
