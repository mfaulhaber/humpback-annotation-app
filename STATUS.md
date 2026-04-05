# Project Status

Current state of the active timeline viewer MVP and the dormant annotation
stack that remains in this repository.

---

## Phase

Timeline viewer MVP pivot implemented on the active frontend surface.

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
  - confidence strip rendering
  - detection overlay rendering
  - toggleable vocalization overlay rendering
  - chunk-based audio playback controls
- Legacy annotation routes removed from the mounted frontend router so the old
  UI is no longer reachable from the active app shell

### Local Development for the Active MVP

- `pnpm dev:timeline` starts the active frontend only
- `TIMELINE_EXPORT_ROOT` mounts a local export directory at `/data/*`
- Local and intended deployed URL shapes are aligned so the viewer consumes the
  same paths in development and CloudFront/S3 hosting
- `pnpm test` now runs frontend Vitest coverage for the active timeline viewer

### Retained Legacy Annotation Stack

- Fastify API with local dev server and Lambda adapter stub
- DynamoDB-backed catalog and labeling data access
- Dev-auth plugin, seed data, real-data ingest, and admin reporting routes
- Folder/sample/detail annotation UI code retained in the repo but hidden from
  the active router
- Legacy integration tests remain available through `pnpm test:legacy`

### Design & Coordination

- Repo-local design spec and implementation plan for the timeline viewer pivot
- Coordination files: AGENTS.md, CLAUDE.md, DECISIONS.md, MEMORY.md, PLANS.md,
  STATUS.md
- Codex workflow docs in `docs/workflows/` with matching `.claude/commands/`
  entrypoints and `.agents/skills/` wrappers

## Not Yet Implemented

- Detection or vocalization label editing in the timeline viewer
- Frontend component or end-to-end coverage for timeline viewer interactions
- Timeline export generation inside this repository
- CloudFront/S3/CDK deployment implementation for the new viewer
- Authentication integration (Cognito — separate plan)
- CI configuration

## Known Constraints and Guardrails

- Optimize for low idle cost first
- Timeline manifests, tiles, and audio remain static same-origin assets
- Application compute must not proxy viewer media bytes
- Legacy annotation code remains in-repo but inactive in the active UI
- Legacy annotation semantics still matter when working on dormant code:
  one current label per sample per user and aggregate reveal only after the
  current user labels
