# ─── Stage 1: 빌드 ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Vite는 빌드타임에 값을 번들에 박는다(런타임 주입 불가) — 서비스 변수를 build arg로 받는다.
#   VITE_API_BASE : REST 베이스. 호출부가 /api 없이 경로를 넘기므로 끝에 /api 포함 필수.
#   VITE_WS_URL   : Socket.io 오리진(/api 없이).
ARG VITE_API_BASE
ARG VITE_WS_URL
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_WS_URL=$VITE_WS_URL

# 의존성 메타데이터만 먼저 복사 (레이어 캐시 활용)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json        ./apps/web/
RUN pnpm install --frozen-lockfile

# 소스 복사
COPY tsconfig.base.json            ./
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src           ./packages/shared/src
COPY apps/web/tsconfig.json apps/web/vite.config.ts apps/web/index.html ./apps/web/
COPY apps/web/tailwind.config.js apps/web/postcss.config.js             ./apps/web/
COPY apps/web/src    ./apps/web/src
COPY apps/web/public ./apps/web/public

# 빌드 순서: shared(dist+타입) → web(tsc -b && vite build)
RUN pnpm --filter @markflow/shared build
RUN pnpm --filter @markflow/web    build


# ─── Stage 2: 실행 (nginx 정적 서빙) ─────────────────────────────────────────
FROM nginx:alpine AS runner
# Railway가 런타임에 $PORT를 주입 → 로컬 기본값 80. nginx 공식 이미지가
# /etc/nginx/templates/*.template 를 envsubst로 렌더해 conf.d/ 로 출력한다.
ENV PORT=80
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
