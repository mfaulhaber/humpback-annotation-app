# Project Status

Current state of the Humpback Annotation App repository.

---

## Phase

Local skeleton application — all 6 phases complete.

## Quick Start

```bash
pnpm install
pnpm dev --seed        # starts DynamoDB Local, API, and frontend
# Open http://localhost:6173
```

## Implemented In This Repository

### Design & Coordination

- V1 architecture spec, technical design pack, local dev stack notes
- DynamoDB schema design and query cookbook
- Coordination files: AGENTS.md, CLAUDE.md, DECISIONS.md, MEMORY.md, PLANS.md,
  STATUS.md

### Foundation (Phase 1)

- pnpm workspace: `frontend/`, `api/`, `cdk/`, `scripts/`, `tests/`
- Node 22 pinning, shared TypeScript baseline (`tsconfig.base.json`)
- Shared types in `api/src/types/` (entities, API shapes, DynamoDB items,
  12 label categories, key builders)
- Config module (`api/src/config.ts`), DynamoDB client (`api/src/lib/dynamo-client.ts`)
- Docker Compose for DynamoDB Local (`docker-compose.yml`)
- Table creation script (`scripts/src/db-local-init.ts`) — Catalog + Labels with GSIs
- Seed data script (`scripts/src/db-local-seed.ts`) — 3 folders, 65 samples, 10 labels
- Placeholder media in `local_media/`

### API (Phases 2-3)

- Fastify server with local dev server (`api/src/server.ts`) and Lambda adapter
  stub (`api/src/lambda.ts`)
- Dev auth plugin (`api/src/plugins/auth.ts`) — reads `x-dev-user`/`x-dev-role` headers
- Catalog routes: `GET /api/folders`, `GET /api/folders/:folderId/samples`,
  `GET /api/samples/:sampleId`
- Annotation route: `PUT /api/samples/:sampleId/label` — TransactWriteItems for
  atomic label + aggregate updates
- Suggest-next route: `GET /api/samples/suggest-next?folderId=`
- Admin route: `GET /api/admin/labels` — role-enforced, multiple filter modes
- `isLabeledByUser` per sample, `?filter=labeled|unlabeled|all` with over-scan pagination
- Conditional aggregate visibility (only after user labels)
- Media URL resolver, local static file serving at `/media/`
- Health check at `/health` (no auth)

### Frontend (Phases 4-5)

- React 19 + Vite with dev proxy to API
- Folder list, sample grid, sample detail pages
- Audio player and spectrogram display
- Label form with 12 categories, relabel support
- Aggregate display with percentage bars (hidden until labeled)
- Filter controls (all/labeled/unlabeled) on sample list
- Suggest-next button navigates to unlabeled sample
- Dev user picker in header (dev_user_1, dev_user_2, admin_user)

### Developer Experience (Phase 6)

- Unified `pnpm dev` — starts DynamoDB Local, inits tables, launches API + frontend
- Vitest integration tests (`tests/src/api-integration.test.ts`)
- `.env.local.example` with documented defaults
- Configurable ports via env vars: `DYNAMODB_PORT` (default 9000),
  `API_PORT` (default 3001), `FRONTEND_PORT` (default 6173)

## Not Yet Implemented

- Infrastructure code (CDK stacks — separate plan)
- Authentication integration (Cognito — separate plan)
- Deployment pipeline (separate plan)
- CI configuration
- Export reporting in admin UI

## Known Constraints and Guardrails

- Optimize for low idle cost first
- Media files are public assets, not proxied through application compute
- V1 uses pre-rendered spectrogram images
- No relational database dependency planned for V1
- Aggregate percentages stay hidden until a user labels the sample
- One current label per sample per user remains a core product rule
