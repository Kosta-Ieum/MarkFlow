import { z } from "zod";

const envSchema = z.object({
  MARKFLOW_API_BASE: z.string().url(),
  // 미설정 시 API_BASE로 폴백(파싱 후 결합) — 스키마 단계에서는 optional만 표시.
  MARKFLOW_WS_URL: z.string().url().optional(),
  MARKFLOW_BOT_EMAIL: z.string().email(),
  MARKFLOW_BOT_PASSWORD: z.string().min(1),
});

export interface Env {
  MARKFLOW_API_BASE: string;
  MARKFLOW_WS_URL: string;
  MARKFLOW_BOT_EMAIL: string;
  MARKFLOW_BOT_PASSWORD: string;
}

/**
 * env 4종을 파싱한다. 실패 시 어떤 변수가 왜 틀렸는지 담은 에러를 throw한다(R1.3).
 * 에러 메시지는 zod의 필드별 사유만 담고 값 자체는 포함하지 않는다(자격증명 비노출).
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const reasons = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n  ");
    throw new Error(`환경변수 오류:\n  ${reasons}`);
  }
  const { MARKFLOW_API_BASE, MARKFLOW_WS_URL, MARKFLOW_BOT_EMAIL, MARKFLOW_BOT_PASSWORD } =
    result.data;
  return {
    MARKFLOW_API_BASE,
    MARKFLOW_WS_URL: MARKFLOW_WS_URL ?? MARKFLOW_API_BASE,
    MARKFLOW_BOT_EMAIL,
    MARKFLOW_BOT_PASSWORD,
  };
}
