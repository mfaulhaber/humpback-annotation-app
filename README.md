# Humpback Annotation App

A web application for annotating whale vocalization samples. Users browse
folders of audio clips, view spectrograms, and submit labels from a set of
12 vocalization categories. Aggregate label statistics are revealed only after
a user submits their own label.

## Prerequisites

- **Node.js 22** — install via [nvm](https://github.com/nvm-sh/nvm) or
  [fnm](https://github.com/Schniz/fnm): `nvm install 22`
- **pnpm 10+** — install via `corepack enable && corepack prepare pnpm@latest --activate`
  or `npm install -g pnpm`
- **Docker** — required for DynamoDB Local
  ([Docker Desktop](https://www.docker.com/products/docker-desktop/),
  [OrbStack](https://orbstack.dev/), or similar)

## Quick Start (Seed Data)

```bash
git clone <repo-url> && cd humpback-annotation-app
pnpm install
pnpm dev --seed
```

This starts the full stack with synthetic test data (3 folders, 65 samples).
Open **http://localhost:6173** in your browser.

## Quick Start (Real Data)

To run against real whale recordings:

```bash
pnpm install
MEDIA_ROOT=/path/to/data/root pnpm dev --ingest /path/to/data/root/positives/humpback
```

This ingests all dataset folders found under the given path and serves audio
and spectrograms from `MEDIA_ROOT`. The expected folder structure is:

```
<MEDIA_ROOT>/
  positives/
    humpback/
      <dataset_name>/          # e.g. noaa_glacier_bay
        YYYY/MM/DD/
          <start>Z_<end>Z.flac # audio (.flac, .wav, or .mp3)
          <start>Z_<end>Z.png  # spectrogram (optional)
```

To ingest a single dataset instead of all subdirectories:

```bash
pnpm db:ingest -- --path /path/to/positives/humpback/noaa_glacier_bay
```

Use `--dry-run` to preview what would be written without touching DynamoDB.

## Manual Setup

If you prefer to run each step individually:

```bash
# 1. Install dependencies
pnpm install

# 2. Start DynamoDB Local
docker compose up -d

# 3. Create tables (idempotent)
pnpm db:local:init

# 4a. Load seed data
pnpm db:local:seed

# 4b. Or ingest real data (instead of seed)
pnpm db:ingest -- --path /path/to/positives/humpback/noaa_glacier_bay

# 5. Start API server (watches for changes)
# Set MEDIA_ROOT if using real data
pnpm --filter @humpback/api dev

# 6. In another terminal — start frontend (watches for changes)
pnpm --filter @humpback/frontend dev
```

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start full local stack (empty DB) |
| `pnpm dev --seed` | Start full local stack with synthetic seed data |
| `MEDIA_ROOT=... pnpm dev --ingest <path>` | Start stack and ingest real data from `<path>` |
| `pnpm typecheck` | Run TypeScript checks across all packages |
| `pnpm build` | Build all packages |
| `pnpm test` | Run tests (requires local stack running) |
| `pnpm db:local:init` | Create DynamoDB tables (idempotent) |
| `pnpm db:local:seed` | Load seed data into DynamoDB Local |
| `pnpm db:ingest -- --path <dir>` | Ingest a single dataset directory |
| `pnpm db:ingest -- --path <dir> --all` | Ingest all dataset subdirectories |
| `pnpm db:ingest -- --path <dir> --dry-run` | Preview ingestion without writing |
| `pnpm --filter @humpback/api dev` | Start API server only |
| `pnpm --filter @humpback/frontend dev` | Start frontend only |

## Local Development

### Dev Auth

The local dev server uses header-based authentication. The frontend includes a
user picker in the top-right corner to switch between:

- **dev_user_1** (annotator)
- **dev_user_2** (annotator)
- **admin_user** (admin)

Switching users reloads the page to reflect the new user's label state.

### API Endpoints

All API routes are prefixed with `/api` and require auth headers:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/folders` | List folders |
| GET | `/api/folders/:folderId/samples` | List samples (supports `?filter=labeled\|unlabeled\|all`) |
| GET | `/api/samples/:sampleId` | Sample detail with conditional aggregate |
| PUT | `/api/samples/:sampleId/label` | Submit/update label |
| GET | `/api/samples/suggest-next?folderId=` | Get a random unlabeled sample |
| GET | `/api/admin/labels` | Admin label reporting (admin role required) |
| GET | `/health` | Health check (no auth) |

### Environment Variables

Copy `.env.local.example` to `.env.local` to customize. Defaults work
out of the box:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `local` | Environment mode |
| `DYNAMODB_PORT` | `9000` | DynamoDB Local port |
| `DYNAMODB_ENDPOINT` | `http://localhost:9000` | DynamoDB endpoint |
| `CATALOG_TABLE` | `Catalog` | Catalog table name |
| `LABELS_TABLE` | `Labels` | Labels table name |
| `MEDIA_ROOT` | `./local_media` | Media root directory (set to data root for real data) |
| `FRONTEND_PORT` | `6173` | Frontend dev server port |
| `AUTH_MODE` | `dev` | Auth mode (`dev` or `cognito`) |
| `AWS_REGION` | `us-west-2` | AWS region |
| `API_PORT` | `3001` | API server port |

### Project Structure

```
humpback-annotation-app/
  api/                  # Fastify API server + Lambda adapter
    src/
      app.ts            # Fastify app (shared between local + Lambda)
      server.ts         # Local dev server entry point
      lambda.ts         # Lambda entry point (stub)
      config.ts         # Environment config
      types/            # Shared type definitions
      data/             # DynamoDB data access layer
      routes/           # Route handlers
      plugins/          # Fastify plugins (auth)
      lib/              # Utilities
  frontend/             # React 19 + Vite
    src/
      pages/            # Route pages
      components/       # UI components
      api/              # API client modules
  scripts/              # Dev tooling scripts
  tests/                # Integration tests (Vitest)
  cdk/                  # Infrastructure (not yet implemented)
  local_media/          # Placeholder audio + spectrogram files
  docker-compose.yml    # DynamoDB Local
```

## Running Tests

Integration tests run against a live local stack:

```bash
# Start the stack first
docker compose up -d
pnpm db:local:init && pnpm db:local:seed
pnpm --filter @humpback/api dev &

# Run tests
pnpm test
```

## Label Categories

The V1 label set for whale vocalizations:

`whup`, `grunt`, `ascending moan`, `descending moan`, `moan`, `upsweep`,
`trumpet`, `growl`, `creak`, `buzz`, `shriek`, `chirp`
