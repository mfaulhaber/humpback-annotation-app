# Humpback Timeline Viewer

The active MVP in this repository is a static React timeline viewer for
exported humpback acoustic jobs. The frontend loads same-origin timeline
artifacts from `/data/*`, renders a landing page of available jobs, and opens a
full-screen timeline workspace for each export. The active viewport is now
canvas-backed so playback can scroll smoothly at fine zoom levels without
changing the static export contract.

The earlier folder/sample annotation stack remains in the repository, but it is
now dormant in the active UI. Its API, DynamoDB, and dev-auth code are still
available for reference and future reuse.

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
  <job_id>/
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
same URL shape locally and in the intended CloudFront/S3 deployment.

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
| `pnpm --filter @humpback/api dev` | Start API server only |
| `pnpm --filter @humpback/frontend dev` | Start the timeline viewer frontend only |

## Local Development

### Timeline Data Contract

The active frontend expects:

- `data/index.json` for the landing page registry
- `data/{jobId}/manifest.json` for viewer metadata
- `data/{jobId}/tiles/{zoom}/tile_0000.png` for spectrogram tiles
- `data/{jobId}/audio/chunk_0000.mp3` for audio chunks

Everything is fetched same-origin. The viewer does not proxy tiles, audio, or
manifests through application compute.

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
  scripts/              # Dev tooling scripts
  tests/                # Integration tests (Vitest)
  cdk/                  # Infrastructure (not yet implemented)
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
