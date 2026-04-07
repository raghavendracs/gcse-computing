# GCSE Coding

A full-stack web platform for GCSE Computer Science revision, featuring AI-powered question generation, interactive Python coding practice with automated marking, and progress tracking.

## Features

- **AI-Powered Questions** — Generates theory and coding questions using Claude, tailored to exam board specifications (OCR, AQA, Edexcel)
- **Python Code Editor** — In-browser CodeMirror editor with syntax highlighting and live execution
- **Automated Marking** — AI-driven answer evaluation for theory questions, test-case-based marking for coding
- **Contextual Hints** — AI-generated hints that guide without giving away answers
- **Progress Tracking** — Per-module mastery tracking, weak area identification, and study session metrics
- **Secure Code Execution** — Isolated Python sandbox with import blocking, timeouts, and containerised execution

## Architecture

```
gcse-coding/
├── apps/
│   ├── api/                  # Express + tRPC backend
│   ├── web/                  # Next.js frontend
│   └── python-sandbox/       # FastAPI Python execution sandbox
├── packages/
│   ├── database/             # Mongoose schemas & models
│   ├── services/             # Business logic & AI integrations
│   └── trpc/                 # tRPC router definitions
├── docs/plans/               # Design & implementation documents
├── docker-compose.yml
└── setup.sh                  # Development setup script
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, CodeMirror 6 |
| API | Express, tRPC 11, Zod |
| Database | MongoDB 7, Mongoose 8 |
| AI | Anthropic Claude (via SDK) |
| Code Sandbox | FastAPI, Python 3.12 |
| Data Fetching | TanStack Query 5 |
| Auth | JWT, bcryptjs |
| Infra | Docker Compose, pnpm workspaces |

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Docker](https://www.docker.com/) (for MongoDB and Python sandbox)
- An [Anthropic API key](https://console.anthropic.com/) for AI features

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/raghavendracs/gcse-computing.git
cd gcse-computing
cp .env.example .env
```

Edit `.env` and fill in your values:

```
JWT_SECRET=<random-string-at-least-32-chars>
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 2. Run with the setup script (recommended)

The setup script starts MongoDB and the Python sandbox in Docker, then runs the API and web app locally with hot reload:

```bash
./setup.sh
```

### 3. Or run everything in Docker

```bash
docker compose up --build
```

The app will be available at:

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| Python Sandbox | http://localhost:8000 |

### 4. Seed the database

```bash
pnpm --filter @gcse/api seed
```

## Development

```bash
# Install dependencies
pnpm install

# Run all apps in dev mode (hot reload)
pnpm dev

# Build all packages
pnpm build

# Lint
pnpm lint

# Type check
pnpm type-check

# Run tests
pnpm test
```

## Project Structure

### Apps

- **api** — Express server with tRPC endpoints for auth, modules, questions, and progress
- **web** — Next.js frontend with dashboard, practice sessions, and code editor
- **python-sandbox** — FastAPI service that executes student Python code in isolation with test cases

### Packages

- **database** — Mongoose models: users, modules, questions, attempts, progress, study sessions
- **services** — Business logic: auth, question generation, theory marking, coding assessment, hints, progress tracking
- **trpc** — Shared tRPC router definitions and client configuration

## Supported Exam Boards

- OCR
- AQA
- Edexcel

## Deployment

### Railway

See [docs/deploy-railway.md](docs/deploy-railway.md) for a step-by-step guide to deploying all three services and MongoDB on [Railway](https://railway.com).

### Docker Compose (self-hosted)

```bash
cp .env.example .env
# Edit .env with your values
docker compose up --build -d
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
