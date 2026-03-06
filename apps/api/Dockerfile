# ─── Stage 1: install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps
RUN npm install -g pnpm@10

WORKDIR /app

# Copy workspace manifests only (for better layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/services/package.json ./packages/services/
COPY packages/trpc/package.json      ./packages/trpc/
COPY apps/api/package.json           ./apps/api/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS builder

COPY tsconfig.base.json ./

# Copy only source files (node_modules already present from deps stage)
COPY packages/database/src        ./packages/database/src
COPY packages/database/tsconfig.json ./packages/database/
COPY packages/services/src        ./packages/services/src
COPY packages/services/tsconfig.json ./packages/services/
COPY packages/trpc/src            ./packages/trpc/src
COPY packages/trpc/tsconfig.json  ./packages/trpc/
COPY apps/api/src                 ./apps/api/src
COPY apps/api/tsconfig.json       ./apps/api/

RUN pnpm --filter @gcse/database build && \
    pnpm --filter @gcse/services  build && \
    pnpm --filter @gcse/trpc      build && \
    pnpm --filter @gcse/api       build

# Create self-contained deployment bundle (workspace deps inlined)
RUN pnpm deploy --filter @gcse/api --prod /prod

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /prod .

EXPOSE 3001
CMD ["node", "dist/index.js"]
