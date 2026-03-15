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

## Quick Start

```bash
git clone <repo-url> && cd humpback-annotation-app
pnpm install
pnpm dev --seed
```

This single command will:

1. Start DynamoDB Local via Docker Compose (port 8000)
2. Create the Catalog and Labels tables
3. Load seed data (3 folders, 65 samples, 10 labels)
4. Start the API server on `http://localhost:3001`
5. Start the frontend dev server on `http://localhost:5173`

Open **http://localhost:5173** in your browser.

## Manual Setup

If you prefer to run each step individually:

```bash
# 1. Install dependencies
pnpm install

# 2. Start DynamoDB Local
docker compose up -d

# 3. Create tables (idempotent)
pnpm db:local:init

# 4. Load seed data
pnpm db:local:seed

# 5. Start API server (watches for changes)
pnpm --filter @humpback/api dev

# 6. In another terminal — start frontend (watches for changes)
pnpm --filter @humpback/frontend dev
```

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start full local stack (add `--seed` to load seed data) |
| `pnpm dev --seed` | Start full local stack with seed data |
| `pnpm typecheck` | Run TypeScript checks across all packages |
| `pnpm build` | Build all packages |
| `pnpm test` | Run tests (requires local stack running) |
| `pnpm db:local:init` | Create DynamoDB tables (idempotent) |
| `pnpm db:local:seed` | Load seed data into DynamoDB Local |
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
| `DYNAMODB_ENDPOINT` | `http://localhost:8000` | DynamoDB endpoint |
| `CATALOG_TABLE` | `Catalog` | Catalog table name |
| `LABELS_TABLE` | `Labels` | Labels table name |
| `MEDIA_ROOT` | `./local_media` | Local media file directory |
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
