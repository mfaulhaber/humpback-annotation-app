# Project Status

Current state of the active timeline viewer MVP and the dormant annotation
stack that remains in this repository.

---

## Phase

Timeline viewer MVP pivot implemented on the active frontend surface, with a
viewer-only AWS publish path now scaffolded in-repo.

## Quick Start

```bash
pnpm install
TIMELINE_EXPORT_ROOT=/path/to/export/data pnpm dev:timeline
# Open http://localhost:6173
```

## Implemented In This Repository

### Active MVP Surface

- React 19 + Vite timeline viewer with two active routes:
  - `/` loads a timeline registry from `data/index.json`
  - `/:jobId` loads a viewer manifest from `data/{jobId}/manifest.json`
- Same-origin loading of static timeline artifacts:
  - spectrogram tiles from `data/{jobId}/tiles/...`
  - audio chunks from `data/{jobId}/audio/...`
- Timeline workspace with:
  - fixed center playhead
  - zoom controls from `24h` through `1m`
  - UTC time labeling
  - canvas-backed viewport rendering for the spectrogram track
  - live playback-clock-driven scrolling for smooth fine-zoom motion
  - compact lower-edge confidence strip rendering in detection mode only
  - full-height detection window indicators, with 5-second-width bars at `15m`/`5m`/`1m` and thin bars at `1h+`
  - exclusive detection or vocalization control modes that can also be toggled off
  - compact bottom-up vocalization lanes with full-height vocalization window indicators sized the same way
  - chunk-based audio playback controls
- Legacy annotation routes removed from the mounted frontend router so the old
  UI is no longer reachable from the active app shell

### Local Development for the Active MVP

- `pnpm dev:timeline` starts the active frontend only
- `TIMELINE_EXPORT_ROOT` mounts a local export directory at `/data/*`
- Local and intended deployed URL shapes are aligned so the viewer consumes the
  same paths in development and CloudFront/S3 hosting
- `pnpm test` now runs frontend Vitest coverage for the active timeline viewer

### Viewer-Only AWS Publish Path

- `cdk/` now contains a deployable CloudFront + S3 stack for the active viewer
- The primary stack region is `us-west-2`
- One private S3 bucket stores the frontend bundle, and one private S3 bucket
  stores the timeline export root
- CloudFront serves the SPA shell from the app bucket and exposes the data
  bucket at `/data/*`
- CloudFront rewrites `/data/*` origin requests so the data bucket stores the
  export root directly as `index.json` plus job folders
- Repo-local publish helpers exist for the app bundle and timeline export data

### Retained Legacy Annotation Stack

- Fastify API with local dev server and Lambda adapter stub
- DynamoDB-backed catalog and labeling data access
- Dev-auth plugin, seed data, real-data ingest, and admin reporting routes
- Folder/sample/detail annotation UI code retained in the repo but hidden from
  the active router
- Legacy integration tests remain available through `pnpm test:legacy`

### Design & Coordination

- Repo-local design spec and implementation plan for the timeline viewer pivot
- Coordination files: AGENTS.md, CLAUDE.md, DECISIONS.md, MEMORY.md, STATUS.md
- Codex workflow docs in `docs/workflows/` with matching `.claude/commands/`
  entrypoints

## Not Yet Implemented

- Detection or vocalization label editing in the timeline viewer
- Frontend component or end-to-end coverage for timeline viewer interactions
- Timeline export generation inside this repository
- Automatic CI/CD for the viewer deployment path
- ACM certificate provisioning inside this repo for CloudFront custom domains
- Authentication integration (Cognito — separate plan, and not part of the
  viewer-only AWS publish path)
- CI configuration

## Known Constraints and Guardrails

- Optimize for low idle cost first
- Timeline manifests, tiles, and audio remain static same-origin assets
- Application compute must not proxy viewer media bytes
- Viewer-only AWS deployment excludes the dormant legacy annotation stack
- Legacy annotation code remains in-repo but inactive in the active UI
- Legacy annotation semantics still matter when working on dormant code:
  one current label per sample per user and aggregate reveal only after the
  current user labels
