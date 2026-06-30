import { z } from "zod";

// 환경변수 검증(Zod) — .env 값을 타입 확정 + 누락 시 서버 시작 차단
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"), // .env 우선, 없을 때만 기본값
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    throw new Error(`환경변수 오류:\n  ${missing}`);
  }
  return result.data;
}

export const env = parseEnv();
