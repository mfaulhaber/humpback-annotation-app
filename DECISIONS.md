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

## ADR-006: Real Whale Data Ingestion With Co-Located Media and Nullable Spectrograms

**Date**: 2026-03-15
**Status**: Accepted

**Context**: Real whale data follows a hierarchical folder structure
(`[root]/positives/humpback/[dataset_name]/YYYY/MM/DD/`) with audio files
(`.flac`, `.wav`, `.mp3`) and spectrogram PNGs co-located in the same day
directory. The existing model assumed separate `samples/` and `spectrograms/`
media trees and required spectrograms on all samples. Many real samples lack
pre-rendered spectrograms.

**Decision**: Make `spectrogramKey` / `spectrogram_key` nullable throughout the
stack (types, DynamoDB items, API responses, frontend). Add a data ingestion
script (`scripts/src/db-ingest.ts`) that discovers audio/PNG pairs from the
enforced folder structure, parses ISO 8601 timestamps from filenames to derive
`capturedAt` and `durationSec`, and writes Folder + Sample items to the Catalog
table. `MEDIA_ROOT` env var points to the data root so media keys are full
relative paths (e.g., `positives/humpback/noaa_glacier_bay/2015/08/07/file.flac`).
Sample IDs are `{dataset_name}_{filename_stem}` for global uniqueness.

**Consequences**:
- Frontend gracefully renders a placeholder when spectrogramUrl is null
- The seed script is preserved as-is for testing; ingestion is a separate path
- No DynamoDB table schema changes — only item content shapes changed
- `MEDIA_ROOT` must point to the data root when using real data
- The `--all` flag ingests multiple datasets under a parent directory

## ADR-007: Pivot the Active Frontend to a Static Timeline Viewer Over Same-Origin Export Artifacts

**Date**: 2026-04-05
**Status**: Accepted

**Context**: The repository originally centered its active user experience on a
folder/sample annotation workflow backed by Fastify and DynamoDB. The new MVP
focuses instead on readonly inspection of exported acoustic timelines. The
approved consumer contract defines a static data layout rooted at `/data/*`,
and the reference viewer expects the frontend to load the registry, manifests,
tiles, and chunked audio directly rather than through an API.

**Decision**: Make the active frontend surface a static React timeline viewer
with two routes: `/` for the timeline registry and `/:jobId` for the viewer.
The viewer consumes `data/index.json`, `data/{jobId}/manifest.json`,
spectrogram tiles, and audio chunks directly from same-origin static paths.
Local development mounts a `TIMELINE_EXPORT_ROOT` directory at `/data` in Vite,
while the intended deployed shape remains CloudFront backed by S3. The legacy
annotation API, DynamoDB schema, and frontend pages remain in the repository
but are removed from the active router and navigation.

**Consequences**:
- Timeline viewing no longer requires API or DynamoDB locally.
- The active frontend now depends on the external export contract rather than
  the annotation API surface.
- Media and timeline artifacts remain URL-addressable and are not proxied
  through compute.
- The repository still contains annotation code, so future work on dormant code
  must continue preserving its label and aggregate semantics.

## ADR-008: Use a Canvas-Backed Timeline Viewport With a Live Playback Clock

**Date**: 2026-04-05
**Status**: Accepted

**Context**: The static timeline viewer initially rendered its spectrogram
tiles and overlays as DOM-positioned elements while playback state flowed from
the audio element's `timeupdate` event into React state. That was sufficient
for basic correctness, but playback scrolling at `5m` and `1m` zoom looked
jerky because browser `timeupdate` events are intentionally low frequency and
the viewport motion became visibly quantized.

**Decision**: Keep the viewer shell in React/DOM, but move the scroll-heavy
timeline track to a canvas-backed viewport. Keep the same static export
contract for manifests, tiles, and chunked audio. Extend the playback hook to
expose a live audio-derived playback timestamp so the viewport and UTC clock
can animate independently of coarse `timeupdate` events.

**Consequences**:
- Smooth playback motion no longer depends on React rerendering the entire page
  from browser-throttled media events.
- Same-origin tile and audio URL semantics remain unchanged.
- Spectrogram drawing and overlay hit testing are now more imperative inside the
  viewport implementation.
- App chrome, controls, and high-level routing remain ordinary React UI.

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
