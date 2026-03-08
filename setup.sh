#!/usr/bin/env bash
# setup.sh — Run MongoDB + Python sandbox in Docker, API + Web locally with hot reload
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${CYAN}[setup]${NC} $*"; }
ok()   { echo -e "${GREEN}[setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[setup]${NC} $*"; }
die()  { echo -e "${RED}[setup]${NC} $*"; exit 1; }

# ── Prerequisites ─────────────────────────────────────────────────────────────
command -v docker  >/dev/null 2>&1 || die "docker not found"
command -v pnpm    >/dev/null 2>&1 || die "pnpm not found — run: npm i -g pnpm"

# ── Load .env ─────────────────────────────────────────────────────────────────
if [ -f "$ROOT/.env" ]; then
  set -a; source "$ROOT/.env"; set +a
  ok "Loaded .env"
else
  warn ".env not found — copy .env.example and fill in values"
fi

# ── Validate required vars ────────────────────────────────────────────────────
[ -z "$ANTHROPIC_API_KEY" ] && warn "ANTHROPIC_API_KEY is not set — question generation will fail"
[ -z "$JWT_SECRET" ]        && warn "JWT_SECRET is not set — using insecure default"

# ── Step 1: Stop Docker API/Web (they'd conflict on the same ports) ───────────
log "Stopping Docker api and web containers (if running)..."
docker compose stop api web 2>/dev/null || true

# ── Step 2: Start only Docker services needed (MongoDB + python-sandbox) ──────
log "Starting MongoDB and Python sandbox via Docker..."
docker compose up -d mongodb python-sandbox

log "Waiting for MongoDB to be healthy..."
until docker compose exec mongodb mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; do
  sleep 1
done
ok "MongoDB is ready"

# ── Step 3: Install workspace dependencies ────────────────────────────────────
log "Installing dependencies..."
pnpm install --frozen-lockfile

# ── Step 3: Build shared packages (needed by API and web) ─────────────────────
log "Building shared packages..."
pnpm --filter @gcse/database build
pnpm --filter @gcse/services  build
pnpm --filter @gcse/trpc      build
ok "Packages built"

# ── Step 4: Launch API and Web in parallel, kill both on Ctrl+C ───────────────
log "Starting API (internal :3001) and Web (port 3000) in dev mode..."
echo ""

# Export env vars for child processes
export MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/gcse}"
export JWT_SECRET="${JWT_SECRET:-dev-secret-change-in-production-min-32-chars}"
export WEB_URL="http://localhost:3000"
export NODE_ENV=development
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
export PYTHON_SANDBOX_URL="${PYTHON_SANDBOX_URL:-http://localhost:8000}"
# Browser hits Next.js on 3000; Next.js rewrites /trpc → API on 3001 internally
export NEXT_PUBLIC_API_URL="http://localhost:3000"   # used by browser tRPC client
export INTERNAL_API_URL="http://localhost:3001"      # used by next.config.ts rewrites (avoids proxy loop)

cleanup() {
  echo ""
  log "Shutting down API and Web..."
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
  wait "$API_PID" "$WEB_PID" 2>/dev/null || true
  log "Done. MongoDB and Python sandbox are still running (docker compose stop to shut them down)."
  exit 0
}
trap cleanup INT TERM

# Start API on port 3001 with tsx watch (PORT only for API, not exported globally)
PORT=3001 pnpm --filter @gcse/api dev &
API_PID=$!

# Start Next.js dev server on port 3000 (no PORT env var so it defaults to 3000)
pnpm --filter web dev &
WEB_PID=$!

ok "App  → http://localhost:3000  (API proxied through Next.js)"
ok "Press Ctrl+C to stop"
echo ""

# Wait for either process to exit
wait -n "$API_PID" "$WEB_PID" 2>/dev/null || wait "$API_PID" "$WEB_PID"
cleanup
