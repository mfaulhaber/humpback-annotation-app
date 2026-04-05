# Development Plans

---

New detailed implementation plans should live in `docs/plans/`. Older
`~/.claude/plans/...` references are retained below only as historical context
until they are migrated or superseded.

## Active

# Plan: Timeline Viewer MVP Pivot

Detailed plan: `docs/plans/2026-04-05-timeline-viewer-mvp.md`

Focus:
- Replace the active annotation routes with a timeline-first landing page and
  viewer
- Serve exported artifacts from same-origin static `/data/*` paths in local
  development and CloudFront/S3 deployment
- Implement the readonly timeline workspace with zoom, playback, and overlay
  layers
- Keep the current annotation stack in-repo but hidden from the active UI

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

- Adapt App for Real Whale Data Structure:
  Detailed plan: `docs/plans/2026-04-05-real-whale-data-structure.md`
  Implemented nullable spectrogram handling across the stack and added
  real-data ingest support for dataset folders under
  `[root]/positives/humpback/[dataset]/YYYY/MM/DD/`.

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
