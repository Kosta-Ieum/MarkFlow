# ─── Stage 1: 빌드 ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
# Prisma 엔진이 libssl을 요구한다 (alpine 기본 미포함)
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# 의존성 메타데이터만 먼저 복사 (레이어 캐시 활용)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json        ./apps/api/
# postinstall(prisma generate)이 스키마를 요구하므로 install 전에 복사
COPY apps/api/prisma              ./apps/api/prisma

RUN pnpm install --frozen-lockfile

# 소스 복사
COPY tsconfig.base.json                       ./
COPY packages/shared/src    ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY apps/api/src           ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/

# 빌드 순서: shared → prisma client 생성 → api
RUN pnpm --filter @markflow/shared build
RUN pnpm --filter @markflow/api    prisma:generate
RUN pnpm --filter @markflow/api    build


# ─── Stage 2: 실행 ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

# node_modules 복사 — 루트(.pnpm 스토어) + 워크스페이스별 심링크 디렉터리.
# pnpm은 각 패키지의 의존성을 자기 node_modules의 심링크로 해석하므로
# 루트만 복사하면 런타임에 모듈 해석이 깨진다 (prisma CLI·@nestjs/* 등).
COPY --from=builder /app/node_modules                  ./node_modules
COPY --from=builder /app/packages/shared/node_modules  ./packages/shared/node_modules
COPY --from=builder /app/apps/api/node_modules         ./apps/api/node_modules

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
