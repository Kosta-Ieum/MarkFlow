// vitest 전용 환경변수 — DB 연결 없이 config/env.ts의 zod 검증을 통과시키기 위한 더미 값.
// 테스트는 PrismaService를 mock으로 대체하므로 DATABASE_URL이 실제로 쓰이지 않는다.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/markflow_test";
process.env.JWT_SECRET ??= "test-jwt-secret-please-ignore";
process.env.NODE_ENV ??= "test";
