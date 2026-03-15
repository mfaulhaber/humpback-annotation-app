# Architecture Decision Log

Append-only record of significant architecture and implementation decisions.
Do not rewrite historical entries once they are accepted; add a new ADR instead.

---

## ADR-001: Use a pnpm Workspace With Node 22 and a Shared TypeScript Baseline

**Date**: 2026-03-14
**Status**: Accepted

**Context**: The repository moved from design-only documents into an initial
bootstrap phase and needed concrete dependency-management and TypeScript
choices. The design docs already implied a multi-package repo shape with
`frontend/`, `api/`, `cdk/`, `scripts/`, and `tests/`, but no package manager,
Node version, or TypeScript baseline had been committed yet.

**Decision**: Use a root `pnpm` workspace, pin the repository to Node 22 LTS,
and install shared TypeScript tooling at the repository root. Keep framework
selection for the frontend and concrete runtime dependencies for API and CDK
out of scope for this decision.

**Consequences**:
- Dependency installation is centralized in one lockfile and one workspace
  layout.
- Root tooling commands now exist for `dev`, `typecheck`, `build`, `test`,
  `db:local:init`, `db:local:seed`, and `cdk:synth`.
- Future implementation work should add runtime dependencies to the appropriate
  workspace package rather than the repository root.
- If the team later changes package manager or Node baseline, record that as a
  new ADR rather than rewriting this entry.

## ADR-002: Add GSI1 to Catalog Table for Folder Listing

**Date**: 2026-03-15
**Status**: Accepted

**Context**: The query cookbook referenced a GSI on the Catalog table for
`GET /folders` (`gsi1pk = "Folder"`), but the schema design doc did not define
this index. A Scan with filter would work at small scale but is not
DynamoDB-idiomatic and would degrade as the table grows.

**Decision**: Add GSI1 to the Catalog table with `gsi1pk` (entity type) and
`gsi1sk` as key attributes. Folder items include `gsi1pk: "Folder"` and
`gsi1sk: "FOLDER#{folder_id}"`. The `db:local:init` script creates this index.

**Consequences**:
- `GET /folders` uses an efficient Query instead of a Scan.
- The schema design doc (`dynamodb_schema_design.md`) has been updated to
  document this GSI.
- On-demand capacity means the GSI has negligible idle cost.
- If other entity types need listing by type in the future, this GSI pattern
  supports it.

## ADR-003: Fastify for API Runtime With Lambda Adapter

**Date**: 2026-03-15
**Status**: Accepted

**Context**: The API needs a framework that runs locally as a dev server and
deploys to AWS Lambda with minimal code changes. The plan evaluated Hono,
Express, and Fastify.

**Decision**: Use Fastify with `@fastify/aws-lambda`. The same `buildApp()`
function is imported by both the local dev server (`server.ts`) and the Lambda
entry point (`lambda.ts`). Local dev runs via `tsx watch` for instant startup
and hot-reload.

**Consequences**:
- `api/src/app.ts` is the single source of truth for routes and middleware.
- Local dev does not require SAM CLI or CDK synth.
- `@fastify/static` serves `./local_media/` locally; Lambda does not serve
  static files.
- Auth is a Fastify plugin that reads dev headers locally and will read JWTs
  in production.

## ADR-004: Direct Fastify Dev Server for Local Skeleton (SAM CLI Deferred)

**Date**: 2026-03-15
**Status**: Accepted

**Context**: The design docs suggest SAM CLI for local API emulation, but SAM
CLI requires CDK synth output which requires complete CDK stack definitions.
CDK stacks are out of scope for the skeleton.

**Decision**: Run the API locally via `tsx watch src/server.ts` using
`@hono/node-server`-style direct serving. SAM CLI integration is deferred to
the infrastructure/deployment plan.

**Consequences**:
- Local API startup is instant with hot-reload.
- API Gateway features (request validation, authorizers) are not tested locally
  until SAM CLI is integrated.
- The handler code is identical in both paths, so no refactoring is needed when
  SAM CLI is added later.

## ADR-005: React 19 + Vite for Frontend

**Date**: 2026-03-15
**Status**: Accepted

**Context**: The frontend needs a build tool and UI framework. The existing
`frontend/tsconfig.json` was already configured for `Bundler` module resolution
and `DOM` libs, pointing toward a Vite-like tool.

**Decision**: Use React 19 with Vite 8 and `@vitejs/plugin-react`. Vite's
dev-server proxy forwards `/api` and `/media` requests to the Fastify API
server at `localhost:3001`, avoiding CORS issues locally.

**Consequences**:
- Frontend runs on `localhost:5173` with hot module replacement.
- Types are shared by importing from `@humpback/api` via workspace dependency.
- The production build is a static bundle that can be deployed to S3/CloudFront.
- React Router handles client-side routing with three routes.

---

Use this template for future decisions:

## ADR-XXX: Decision Title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Superseded

**Context**: Why this decision is needed.

**Decision**: What was chosen.

**Consequences**:
- Impact on architecture
- Impact on implementation
- Follow-up work or migration notes
