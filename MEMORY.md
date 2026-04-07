# Humpback Timeline Viewer — Reference Memory

Stable reference material for the active timeline viewer MVP and the dormant
annotation stack retained in this repo. For behavioral rules and repo
conventions, see `CLAUDE.md`.

---

## Project Snapshot

- Domain: humpback acoustic timeline browsing and inspection
- Active user flows:
  - browse exported jobs from a timeline registry
  - inspect one job in a full-screen timeline viewer
  - zoom, pan, and play chunked audio against static spectrogram tiles through
    a canvas-backed viewport
- Current repo state:
  - active React/Vite timeline viewer implemented in `frontend/`
  - viewer-only CloudFront/S3 deployment stack implemented in `cdk/`
  - dormant Fastify/DynamoDB annotation stack retained in `api/`, `scripts/`,
    and `tests/`
  - production auth for the legacy stack and CI/CD remain planned
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
├── STATUS.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .claude/
│   └── commands/
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

## Current System Shape

| Layer | Current design direction |
|-------|--------------------------|
| Frontend | Static React timeline viewer served through a CDN |
| Timeline Data | Same-origin exported artifacts under `/data/*` |
| Media | Public object storage for timeline audio chunks and spectrogram tiles |
| Active Backend | None required for readonly timeline viewing |
| Legacy Backend | Dormant Fastify API for folder/sample annotation flows |
| Legacy Data Store | DynamoDB-style catalog and labels tables |
| Auth | Managed user authentication with local dev auth override |
| IaC | Viewer-only CloudFront/S3 deployment via CDK in `us-west-2` |

## Active Product Rules

- The active viewer is readonly
- Landing page data comes from `/data/index.json`
- Viewer data comes from `/data/{jobId}/manifest.json`
- Tiles, audio chunks, and manifests stay URL-addressable and same-origin
- Viewer time displays are UTC
- The app must not proxy tiles or audio through compute
- The active AWS publish path excludes the dormant legacy annotation stack
- Legacy annotation semantics remain intact in dormant code when touched

## Timeline Viewer Routes

- `/`
- `/:jobId`

## Timeline Export Contract

### Registry

- `data/index.json`
- shape:
  - `timelines[]`
  - `job_id` as a UUID string
  - `hydrophone_name`
  - `species`
  - `start_timestamp`
  - `end_timestamp`

### Manifest

- `data/{jobId}/manifest.json`
- major sections:
  - `job`
    - `job.id` as a UUID string
  - `tiles`
  - `audio`
  - `confidence`
  - `detections`
  - `vocalization_labels`
  - `vocalization_types`

### Zoom Levels

- `24h`
- `6h`
- `1h`
- `15m`
- `5m`
- `1m`

### Viewer Interaction Model

- one centered playhead drives viewport state
- panning changes `centerTimestamp`
- playback advances `centerTimestamp`
- the rendered viewport samples a live audio-derived playback clock while
  playing so fine zoom levels move smoothly
- tiles are selected by zoom level plus visible time range
- confidence, detections, and vocalizations align to the same time axis

## AWS Static Viewer Deployment

- primary deployment region: `us-west-2`
- viewer hosting shape:
  - CloudFront distribution
  - private S3 app bucket for the Vite bundle
  - private S3 data bucket for the export root
- CloudFront serves the SPA shell from the app bucket
- CloudFront exposes export artifacts at `/data/*`
- the data bucket stores the export root directly:
  - `index.json`
  - `{jobId}/manifest.json`
  - `{jobId}/tiles/*`
  - `{jobId}/audio/*`
- CloudFront strips the `/data` prefix before origin fetches so the bucket does
  not need a nested `data/` folder
- custom-domain certificates for CloudFront must still live in `us-east-1`
- the active AWS path does not deploy the dormant annotation API, DynamoDB
  tables, or auth flow

## Legacy Annotation Entities

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

## Legacy Annotation API Surface

- `GET /folders`
- `GET /folders/{folderId}/samples`
- `GET /samples/{sampleId}`
- `GET /samples/suggest-next`
- `PUT /samples/{sampleId}/label`
- `GET /admin/labels`

## Legacy Annotation Data Access Patterns

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

## Legacy DynamoDB Reference Design

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

## Legacy Label Write Rules

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

## Legacy Suggest-Next Strategy

V1 design direction:

1. Query candidate samples within the active folder.
2. Batch-check which samples the current user already labeled.
3. Return one unlabeled candidate.

Possible selection policies:

- random unlabeled sample
- next unlabeled sample by sort order

## Local Development Reference

Active local viewer path:

- `TIMELINE_EXPORT_ROOT=/path/to/export/data pnpm dev:timeline`
- Vite mounts that directory at `/data/*`
- No API or DynamoDB is required to view timelines locally

Active AWS viewer path:

- `pnpm cdk:synth`
- `pnpm cdk:deploy`
- `pnpm publish:viewer:app`
- `pnpm publish:viewer:data -- --path <export-root>`

Dormant annotation stack path:

- React + Vite frontend dev server
- Fastify API dev server
- DynamoDB Local via Docker Compose
- local media folder or external `MEDIA_ROOT`
- scripts for table init, seed data, and real-data ingest
- dev-auth headers plus the dormant frontend user picker for local user
  simulation

Representative local environment variables:

- `TIMELINE_EXPORT_ROOT=/path/to/export/data`
- `APP_ENV=local`
- `DYNAMODB_ENDPOINT=http://localhost:9000`
- `CATALOG_TABLE=Catalog`
- `LABELS_TABLE=Labels`
- `MEDIA_ROOT=./local_media`
- `API_PORT=3001`
- `FRONTEND_PORT=6173`
- `AUTH_MODE=dev`
- `AWS_REGION=us-west-2`

Representative deploy environment variables:

- `AWS_REGION=us-west-2`
- `STATIC_VIEWER_STACK_NAME=humpback-static-viewer`
- `STATIC_VIEWER_PRICE_CLASS=PriceClass_100`
- `STATIC_VIEWER_APP_BUCKET_NAME=...`
- `STATIC_VIEWER_DATA_BUCKET_NAME=...`
- `STATIC_VIEWER_DISTRIBUTION_ID=...`
- `STATIC_VIEWER_DOMAIN_NAME=...` optional
- `STATIC_VIEWER_CERTIFICATE_ARN=...` optional and must refer to `us-east-1`
- `TIMELINE_EXPORT_ROOT=/path/to/export/root`

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
- `pnpm test:legacy`
- `pnpm db:local:init`
- `pnpm db:local:seed`
- `pnpm db:ingest -- --path <dir>`
- `pnpm cdk:synth`
- `pnpm cdk:deploy`
- `pnpm publish:viewer:app`
- `pnpm publish:viewer:data -- --path <export-root>`

Current command behavior:

- `pnpm dev` orchestrates DynamoDB Local, table initialization, and the local
  API + frontend dev servers
- `pnpm typecheck` and `pnpm build` run across the workspace packages
- `pnpm test` runs the active frontend Vitest suite for timeline viewer logic
- `pnpm test:legacy` runs the dormant API integration suite and expects the
  local stack to be available
- `pnpm db:local:init` and `pnpm db:local:seed` create and populate local
  DynamoDB tables
- `pnpm db:ingest` imports real dataset folders into the Catalog table
- `pnpm cdk:synth` synthesizes the viewer-only CloudFront/S3 stack
- `pnpm cdk:deploy` deploys the viewer-only CloudFront/S3 stack in `us-west-2`
- `pnpm publish:viewer:app` uploads the built Vite bundle to the app bucket
- `pnpm publish:viewer:data` uploads one timeline export root to the data
  bucket and invalidates `/data/index.json` plus changed manifest paths
