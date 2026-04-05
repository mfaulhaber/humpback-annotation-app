# Humpback Annotation App — Reference Memory

Stable reference material for the whale annotation application. This file keeps
the repo's current design assumptions in one place. For behavioral rules and
repo conventions, see `CLAUDE.md`.

---

## Project Snapshot

- Domain: whale vocalization sample browsing and labeling
- Primary user flows: browse, preview, label, reveal aggregate after labeling,
  suggest next unlabeled sample, admin reporting
- Current repo state: local skeleton application implemented across
  `frontend/`, `api/`, `scripts/`, and `tests/`; production auth, deployment,
  and CI/CD remain planned
- Session workflow guidance now lives in `docs/workflows/` with matching
  `.claude/commands/` entrypoints and repo-local plan files in `docs/plans/`

## Current Repository Layout

```text
humpback-annotation-app/
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── DECISIONS.md
├── MEMORY.md
├── PLANS.md
├── STATUS.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .claude/
│   └── commands/
├── .agents/
│   └── skills/
├── docs/
│   ├── plans/
│   ├── specs/
│   └── workflows/
├── frontend/
├── api/
├── cdk/
├── scripts/
├── tests/
├── local_media/
├── technical_high_level_design_pack.md
├── whale_annotation_v1_architecture_spec.md
├── whale_annotation_local_development_stack.md
├── dynamodb_schema_design.md
└── dynamodb_query_cookbook.md
```

## Planned System Shape

| Layer | Current design direction |
|-------|--------------------------|
| Frontend | Static web application served through a CDN |
| Media | Public object storage for audio clips and spectrograms |
| Backend | Authenticated serverless API |
| Catalog | Metadata/query service for folders and samples |
| Annotation | Label write path plus aggregate maintenance |
| Suggestion | Select next unlabeled sample within scope |
| Reporting | Admin-only label reporting and export |
| Data Store | DynamoDB-style catalog and labels tables |
| Auth | Managed user authentication with local dev auth override |
| IaC | Cloud deployment via infrastructure-as-code |

## Product Rules

- One current label per sample per user
- Aggregate percentages hidden until that user labels the sample
- Users can browse without first labeling
- Suggested-next is optional but in scope for V1
- Media assets are public
- Spectrograms are pre-rendered in V1

## Core Entities

### Folder

- `folder_id`
- `name`
- `description`
- `sample_count`
- `created_at`

### Sample

- `sample_id`
- `folder_id`
- `source_recording_id`
- `captured_at`
- `audio_key`
- `spectrogram_key`
- `duration_sec`
- `is_active`

### User

- `user_id`
- `display_name`
- `role`
- `status`
- `created_at`

### UserSampleLabel

- `sample_id`
- `user_id`
- `label_category`
- `submitted_at`
- `updated_at`

Constraint:

- unique `(sample_id, user_id)`

### SampleAggregate

- `sample_id`
- `total_labels`
- `counts_by_category`
- `percentages_by_category` returned by API
- `updated_at`

## Planned API Surface

- `GET /folders`
- `GET /folders/{folderId}/samples`
- `GET /samples/{sampleId}`
- `GET /samples/suggest-next`
- `PUT /samples/{sampleId}/label`
- `GET /admin/labels`

## Data Access Patterns

### Folder browse

- list samples by folder
- join per-user label state
- support labeled/unlabeled filtering

### Sample detail

- fetch sample metadata
- fetch current user's label
- fetch aggregate only when that user has already labeled

### Submit label

- upsert `UserSampleLabel`
- update `SampleAggregate`
- handle both first-label and relabel cases atomically

### Admin reporting

- filter labels by user, sample, folder, category, and date range
- avoid aggregate recomputation for routine reporting

## DynamoDB Reference Design

### Table: Catalog

Purpose:

- store folders
- store folder-scoped sample browse rows
- store sample detail rows

Primary key:

- `PK = pk`
- `SK = sk`

Item types:

- `Folder`: `PK = FOLDER#{folder_id}`, `SK = META`
- `SampleRef`: `PK = FOLDER#{folder_id}`, `SK = SAMPLE#{timestamp}#{sample_id}`
- `Sample`: `PK = SAMPLE#{sample_id}`, `SK = META`

### Table: Labels

Purpose:

- store current user labels
- store sample aggregates
- support admin reporting

Primary key:

- `PK = pk`
- `SK = sk`

Item types and indexes:

- `UserSampleLabel`: `PK = USER#{user_id}`, `SK = LABEL#{sample_id}`
- `SampleAggregate`: `PK = SAMPLE#{sample_id}`, `SK = AGGREGATE`
- `GSI1`: labels by sample using `GSI1PK = SAMPLE#{sample_id}`
- `GSI2`: labels by folder/date using `GSI2PK = FOLDER#{folder_id}`

## Label Write Rules

### First label

1. Create or upsert the user label row.
2. Increment aggregate count for the selected category.
3. Increment aggregate total.

### Relabel

1. Read the previous label.
2. Update the user label row.
3. Decrement the old category count.
4. Increment the new category count.

Treat the label write and aggregate update as one logical transaction.

## Suggest-Next Strategy

V1 design direction:

1. Query candidate samples within the active folder.
2. Batch-check which samples the current user already labeled.
3. Return one unlabeled candidate.

Possible selection policies:

- random unlabeled sample
- next unlabeled sample by sort order

## Local Development Reference

Current local stack:

- React + Vite frontend dev server
- Fastify API dev server
- DynamoDB Local via Docker Compose
- local media folder or external `MEDIA_ROOT`
- scripts for table init, seed data, and real-data ingest
- dev-auth headers plus the frontend user picker for local user simulation

Representative local environment variables:

- `APP_ENV=local`
- `DYNAMODB_ENDPOINT=http://localhost:9000`
- `CATALOG_TABLE=Catalog`
- `LABELS_TABLE=Labels`
- `MEDIA_ROOT=./local_media`
- `API_PORT=3001`
- `FRONTEND_PORT=6173`
- `AUTH_MODE=dev`
- `AWS_REGION=us-west-2`

Representative local auth headers:

- `x-dev-user: dev_user_1`
- `x-dev-role: annotator`
- `x-dev-user: admin_user`
- `x-dev-role: admin`

## Tooling Baseline

- Package manager: `pnpm@10.29.3`
- Pinned runtime: Node 22 via `.nvmrc` and `.node-version`
- Shared TypeScript tooling at repo root:
  `typescript@5.9.3`, `tsx@4.21.0`, `@types/node@22.19.15`
- Workspace packages:
  - `frontend` for the React + Vite app
  - `api` for the Fastify API and Lambda adapter stub
  - `cdk` for infrastructure stubs and future deployment code
  - `scripts` for local orchestration, bootstrap, and ingest helpers
  - `tests` for Vitest integration coverage

Bootstrap commands available today:

- `pnpm install`
- `pnpm dev`
- `pnpm dev --seed`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm db:local:init`
- `pnpm db:local:seed`
- `pnpm db:ingest -- --path <dir>`
- `pnpm cdk:synth`

Current command behavior:

- `pnpm dev` orchestrates DynamoDB Local, table initialization, and the local
  API + frontend dev servers
- `pnpm typecheck` and `pnpm build` run across the workspace packages
- `pnpm test` runs the Vitest integration suite and expects the local stack to
  be available
- `pnpm db:local:init` and `pnpm db:local:seed` create and populate local
  DynamoDB tables
- `pnpm db:ingest` imports real dataset folders into the Catalog table
- `pnpm cdk:synth` synthesizes the current CDK stubs
