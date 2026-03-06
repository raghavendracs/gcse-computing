# ─── Stage 1: install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps
RUN npm install -g pnpm@10

WORKDIR /app

# Copy workspace manifests only (for better layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/services/package.json ./packages/services/
COPY packages/trpc/package.json      ./packages/trpc/
COPY apps/web/package.json           ./apps/web/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS builder

COPY tsconfig.base.json ./

# Copy workspace package sources (node_modules already present from deps stage)
COPY packages/database/src           ./packages/database/src
COPY packages/database/tsconfig.json ./packages/database/
COPY packages/services/src           ./packages/services/src
COPY packages/services/tsconfig.json ./packages/services/
COPY packages/trpc/src               ./packages/trpc/src
COPY packages/trpc/tsconfig.json     ./packages/trpc/

# Build shared packages
RUN pnpm --filter @gcse/database build && \
    pnpm --filter @gcse/services  build && \
    pnpm --filter @gcse/trpc      build

# Copy the Next.js app source
COPY apps/web ./apps/web

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
# The browser calls the API via localhost port-mapping, so http://localhost:3001
# is correct for both local docker-compose and deployed setups where the API
# is on the same host. Override via --build-arg if needed.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter web build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# next build --standalone outputs the entire server + minimal node_modules
# into .next/standalone, mirroring the monorepo directory structure.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static      ./apps/web/.next/static
COPY --from=builder /app/apps/web/public            ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
