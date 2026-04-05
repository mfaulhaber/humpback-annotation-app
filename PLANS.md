# Development Plans

---

New detailed implementation plans should live in `docs/plans/`. Older
`~/.claude/plans/...` references are retained below only as historical context
until they are migrated or superseded.

## Active

# Plan: Adapt App for Real Whale Data Structure

Detailed plan: `docs/plans/2026-04-05-real-whale-data-structure.md`

Focus:
- Make spectrogramKey nullable across types, API, and frontend
- Create data ingestion script for real folder structure (`[root]/positives/humpback/[dataset]/YYYY/MM/DD/`)
- Support co-located audio + PNG files with timestamp-based filenames
- Add `db:ingest` script with --dry-run, --all, --path flags

## Backlog

# Plan: Finalize Infrastructure and Deployment Shape

Focus:

- CDK stacks for API Gateway, Lambda, DynamoDB, S3, CloudFront
- SAM CLI integration for local API testing with CDK synth output
- environment configuration (dev, staging, prod)
- confirm local-to-cloud parity expectations

# Plan: Authentication Integration

Focus:

- AWS Cognito user pool and identity pool
- API Gateway authorizers
- replace dev auth headers with JWT validation in production
- user registration and sign-in flow in frontend

# Plan: CI/CD Pipeline

Focus:

- GitHub Actions for typecheck, test, build
- automated deployment to AWS
- environment promotion strategy

## Recently Completed

- Add Environment Variables for Configurable Ports:
  Detailed plan: `~/.claude/plans/nested-crafting-fox.md`
  Added `DYNAMODB_PORT` (default 9000), `FRONTEND_PORT` (default 6173) env vars.
  `API_PORT` already existed (default 3001). Updated 8 files.

- Local Skeleton Application (Phases 1-6):
  Detailed plan: `~/.claude/plans/quirky-drifting-pizza.md`
  Stack: Fastify (API), React + Vite (frontend), DynamoDB Local via Docker
  Compose. All code structured for future Lambda deployment. Includes unified
  `pnpm dev` startup, Vitest integration tests, and full documentation updates.

- Added initial dependency-management and TypeScript bootstrap:
  `pnpm` workspace, Node 22 pinning, shared `tsconfig` baseline, and
  placeholder package scripts.
