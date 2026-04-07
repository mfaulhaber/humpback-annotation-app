# Humpback Timeline Viewer

The active MVP in this repository is a static React timeline viewer for
exported humpback acoustic jobs. The frontend loads same-origin timeline
artifacts from `/data/*`, renders a landing page of available jobs, and opens a
full-screen timeline workspace for each export. The active viewport is now
canvas-backed so playback can scroll smoothly at fine zoom levels without
changing the static export contract.

The earlier folder/sample annotation stack remains in the repository, but it is
now dormant in the active UI. Its API, DynamoDB, and dev-auth code are still
available for reference and future reuse, but the active AWS publish path in
this repo intentionally excludes that legacy stack.

## Prerequisites

- **Node.js 22** — install via [nvm](https://github.com/nvm-sh/nvm) or
  [fnm](https://github.com/Schniz/fnm): `nvm install 22`
- **pnpm 10+** — install via `corepack enable && corepack prepare pnpm@latest --activate`
  or `npm install -g pnpm`
- **Docker** — only required when working on the dormant annotation API stack
  backed by DynamoDB Local

## Quick Start (Timeline Viewer MVP)

```bash
git clone <repo-url> && cd humpback-annotation-app
pnpm install
TIMELINE_EXPORT_ROOT=/path/to/export/data pnpm dev:timeline
```

Open **http://localhost:6173** in your browser.

The export root should contain `index.json` and one folder per job:

```text
<TIMELINE_EXPORT_ROOT>/
  index.json
  <job_id-uuid>/
    manifest.json
    tiles/
      24h/tile_0000.png
      6h/tile_0000.png
      1h/tile_0000.png
      15m/tile_0000.png
      5m/tile_0000.png
      1m/tile_0000.png
    audio/
      chunk_0000.mp3
```

The Vite dev server mounts that directory at `/data`, so the browser uses the
same URL shape locally and in the deployed CloudFront/S3 viewer path.

## Active Routes

- `/` — landing page listing available timelines from `data/index.json`
- `/:jobId` — timeline viewer driven by `data/{jobId}/manifest.json`

## Legacy Annotation Stack

The older annotation workflow is still implemented in-repo, but its routes are
hidden from the active app shell.

Use the legacy stack only when you are intentionally working on that dormant
code path:

```bash
MEDIA_ROOT=/path/to/data/root pnpm dev --ingest /path/to/data/root/positives/humpback
```

## Available Commands

| Command | Description |
|---------|-------------|
| `TIMELINE_EXPORT_ROOT=... pnpm dev:timeline` | Start the active timeline viewer against local exported artifacts |
| `pnpm typecheck` | Run TypeScript checks across all packages |
| `pnpm build` | Build all packages |
| `pnpm test` | Run the active frontend Vitest suite for the timeline viewer |
| `pnpm test:legacy` | Run the dormant API integration suite after starting its local stack |
| `pnpm dev` | Start the dormant local annotation stack (empty DB) |
| `pnpm dev --seed` | Start the dormant annotation stack with synthetic seed data |
| `MEDIA_ROOT=... pnpm dev --ingest <path>` | Start the dormant stack and ingest real data from `<path>` |
| `pnpm db:local:init` | Create DynamoDB tables (idempotent) |
| `pnpm db:local:seed` | Load seed data into DynamoDB Local |
| `pnpm db:ingest -- --path <dir>` | Ingest a single dataset directory |
| `pnpm db:ingest -- --path <dir> --all` | Ingest all dataset subdirectories |
| `pnpm db:ingest -- --path <dir> --dry-run` | Preview ingestion without writing |
| `pnpm cdk:synth` | Synthesize the viewer-only CloudFront/S3 stack |
| `pnpm cdk:diff` | Diff the viewer-only CloudFront/S3 stack |
| `pnpm cdk:deploy` | Deploy the viewer-only CloudFront/S3 stack |
| `pnpm publish:viewer:app` | Upload the built frontend bundle to the deployed app bucket |
| `pnpm publish:viewer:data -- --path <export-root>` | Upload one export root to the deployed data bucket |
| `pnpm --filter @humpback/api dev` | Start API server only |
| `pnpm --filter @humpback/frontend dev` | Start the timeline viewer frontend only |

## Local Development

### Timeline Data Contract

The active frontend expects:

- `data/index.json` for the landing page registry
- `data/{jobId}/manifest.json` for viewer metadata
- `data/{jobId}/tiles/{zoom}/tile_0000.png` for spectrogram tiles
- `data/{jobId}/audio/chunk_0000.mp3` for audio chunks
- `job_id` / `job.id` values in the export contract to be UUID strings

Everything is fetched same-origin. The viewer does not proxy tiles, audio, or
manifests through application compute.

## AWS Deployment

The active deployment path is viewer-only:

- primary stack region: `us-west-2`
- public entry point: one CloudFront distribution
- app hosting: private S3 app bucket
- timeline data hosting: private S3 data bucket
- legacy annotation API, DynamoDB, auth, and `/api/*` routes are not part of
  this publish path

CloudFront serves the SPA shell from the app bucket and exposes the export data
at `/data/*` from the separate data bucket. The export root itself stays
rooted at `index.json` plus job folders in S3; CloudFront rewrites the `/data`
prefix before origin fetches, so you do not need to upload a nested `data/`
directory into the bucket.

### Deploy The Stack

Copy `.env.deploy.example` to `.env.deploy` or export the same variables in
your shell.

Minimum inputs:

- `AWS_REGION=us-west-2`
- optional bucket-name overrides through
  `STATIC_VIEWER_APP_BUCKET_NAME` and `STATIC_VIEWER_DATA_BUCKET_NAME`

Custom domain inputs, if wanted:

- `STATIC_VIEWER_DOMAIN_NAME`
- `STATIC_VIEWER_CERTIFICATE_ARN`
- optional `STATIC_VIEWER_HOSTED_ZONE_ID` and `STATIC_VIEWER_HOSTED_ZONE_NAME`

Note: CloudFront certificates still have to live in `us-east-1`, even though
the main stack targets `us-west-2`.

Deploy flow:

```bash
pnpm cdk:synth
pnpm cdk:deploy
```

After deploy, capture the stack outputs for:

- app bucket name
- data bucket name
- CloudFront distribution ID
- CloudFront domain name

### Publish The Viewer Bundle

```bash
STATIC_VIEWER_APP_BUCKET_NAME=... \
STATIC_VIEWER_DISTRIBUTION_ID=... \
pnpm publish:viewer:app
```

By default the command builds `frontend/dist`, uploads it to the app bucket,
and invalidates `/` plus `/index.html`.

### Publish Timeline Export Data

```bash
STATIC_VIEWER_DATA_BUCKET_NAME=... \
STATIC_VIEWER_DISTRIBUTION_ID=... \
pnpm publish:viewer:data -- --path /path/to/export/root
```

The export root must contain `index.json` and job folders. The publish command
uploads that root directly to the data bucket and invalidates `/data/index.json`
plus any changed manifest paths.

### Viewer Rendering Notes

- The timeline track is canvas-backed for smooth playback scrolling at `15m`,
  `5m`, and `1m`
- The playback hook exposes a live audio-derived clock so the viewport and UTC
  time readout are not limited by coarse browser `timeupdate` events
- Spectrogram tiles still load from the existing same-origin export paths and
  are drawn from the client-side tile cache

### Environment Variables

Copy `.env.local.example` to `.env.local` to customize. Defaults work
out of the box:

| Variable | Default | Description |
|----------|---------|-------------|
| `TIMELINE_EXPORT_ROOT` | unset | Local directory mounted at `/data` for the active timeline viewer |
| `DYNAMODB_PORT` | `9000` | DynamoDB Local port |
| `DYNAMODB_ENDPOINT` | `http://localhost:9000` | DynamoDB endpoint |
| `CATALOG_TABLE` | `Catalog` | Catalog table name |
| `LABELS_TABLE` | `Labels` | Labels table name |
| `MEDIA_ROOT` | `./local_media` | Media root directory for the dormant annotation stack |
| `FRONTEND_PORT` | `6173` | Frontend dev server port |
| `AUTH_MODE` | `dev` | Auth mode for the dormant API stack (`dev` or `cognito`) |
| `AWS_REGION` | `us-west-2` | AWS region |
| `API_PORT` | `3001` | API server port |

### Project Structure

```
humpback-annotation-app/
  frontend/             # Active React + Vite timeline viewer
    src/
      pages/            # Landing page + timeline viewer routes
      components/       # Timeline UI components
      api/              # Timeline registry / manifest loaders
      lib/              # Contract, math, and cache utilities
  api/                  # Dormant Fastify API server + Lambda adapter
    src/
      routes/           # Legacy annotation/catalog/admin routes
  scripts/              # Dev tooling scripts plus viewer publish helpers
  tests/                # Integration tests (Vitest)
  cdk/                  # Viewer-only CloudFront/S3 deployment stack
  local_media/          # Placeholder audio + spectrogram files
  docker-compose.yml    # DynamoDB Local
```

## Running Tests

- `pnpm test` runs the active frontend Vitest suite for timeline contract and
  canvas viewport utility coverage. It does not require DynamoDB Local or the
  dormant API stack.
- `pnpm test:legacy` runs the older integration suite in `tests/`. Use it only
  when you are intentionally changing the dormant annotation/API path and have
  started the required local services.
- `pnpm typecheck` and `pnpm build` remain the baseline verification gates for
  all meaningful changes.
