# Contributing

Thanks for your interest in contributing to GCSE Coding!

## Getting Started

1. Fork the repository
2. Clone your fork and create a branch: `git checkout -b my-feature`
3. Follow the [Quick Start](README.md#quick-start) to set up your dev environment
4. Make your changes
5. Run tests: `pnpm test`
6. Run lint: `pnpm lint`
7. Push and open a pull request

## Development Guidelines

- **TypeScript** — All code is written in TypeScript with strict mode
- **Validation** — Use Zod schemas for all input validation
- **Services** — Business logic lives in `packages/services/`, not in route handlers
- **Database** — Always scope queries by `organizationId` or `studentId` as appropriate
- **Tests** — Add tests for new service methods in `__tests__/` directories

## Project Structure

See the [Architecture section](README.md#architecture) in the README for an overview of the monorepo layout.

## Reporting Issues

Open an issue with:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behaviour

## Code Style

- Use `pnpm lint` to check for issues
- Prefer `async/await` over raw promises
- Keep functions focused and small
