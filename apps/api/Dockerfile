# ─── Stage 1: 빌드 ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# 의존성 메타데이터만 먼저 복사 (레이어 캐시 활용)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json        ./apps/api/

RUN pnpm install --frozen-lockfile

# 소스 복사
COPY tsconfig.base.json                       ./
COPY packages/shared/src    ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY apps/api/src           ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/prisma        ./apps/api/prisma

# 빌드 순서: shared → prisma client 생성 → api
RUN pnpm --filter @markflow/shared build
RUN pnpm --filter @markflow/api    prisma:generate
RUN pnpm --filter @markflow/api    build


# ─── Stage 2: 실행 ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# node_modules 전체 복사 (prisma 생성 클라이언트 포함)
COPY --from=builder /app/node_modules        ./node_modules

# shared (dist만)
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist         ./packages/shared/dist

# api (dist + prisma 스키마)
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist         ./apps/api/dist
COPY --from=builder /app/apps/api/prisma       ./apps/api/prisma

COPY pnpm-workspace.yaml package.json ./

EXPOSE 4000

# 시작 시: 마이그레이션 적용 → 서버 실행
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && cd /app && node apps/api/dist/main.js"]
