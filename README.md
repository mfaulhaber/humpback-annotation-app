# Humpback Timeline Viewer

Humpback Timeline Viewer is a static React app for exploring exported acoustic
jobs from long-running hydrophone recordings. The app loads same-origin data
from `/data/*`, lists available jobs on the landing page, and opens each job in
a full-screen timeline workspace with spectrogram tiles, chunked audio,
detections, and vocalization overlays.

## Overview

The audio behind these timelines comes from long-running underwater recordings
collected by hydrophones, including sources such as Orcasound listening
stations and NOAA archive material. Those recordings are processed upstream
into reviewable timeline exports so the browser can focus on exploration
instead of heavy audio analysis work.

In that upstream pipeline, short slices of audio are turned into acoustic
embeddings using Google Perch or SurfPerch. Those embeddings act as compact
summaries of the sound and are used to train a first-pass binary classifier
that separates likely whale audio from background noise or other non-whale
sounds.

After that whale-versus-not-whale step, additional classifiers are trained for
individual humpback vocalization types. That makes it possible to surface
likely detections and likely call labels together, so a reviewer can move
through a long recording with much more context than raw audio alone would
provide.

The viewer brings those prepared results together in one readonly workspace. It
supports:

- opening any exported job from the landing page
- zooming between `24h`, `6h`, `1h`, `15m`, `5m`, and `1m`
- playing and pausing audio with skip and playback-rate controls
- keeping the UTC time readout aligned with the live playhead
- toggling detections and vocalizations while exploring the spectrogram

## Prerequisites

- **Node.js 22**
- **pnpm 10+**

Install dependencies with:

```bash
pnpm install
```

## Quick Start

```bash
git clone <repo-url>
cd <repo-directory>
pnpm install
TIMELINE_EXPORT_ROOT=/path/to/export/root pnpm dev:timeline
```

Open [http://localhost:6173](http://localhost:6173).

The Vite dev server mounts `TIMELINE_EXPORT_ROOT` at `/data`, so the browser
uses the same URL shape locally and in the deployed CloudFront/S3 viewer path.

## Export Layout

The export root should contain `index.json` plus one directory per job:

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

## Data Contract

The app expects:

- `data/index.json` for the landing-page registry
- `data/{jobId}/manifest.json` for viewer metadata
- `data/{jobId}/tiles/{zoom}/tile_0000.png` for spectrogram tiles
- `data/{jobId}/audio/chunk_0000.mp3` for audio chunks
- UUID job ids in both `job_id` and `job.id`
- an optional `hints` string on each landing-page entry

Everything is fetched same-origin. The viewer does not proxy manifests, tiles,
or audio through application compute.

Example `data/index.json` entry:

```json
{
  "job_id": "8224c4a6-bc36-43db-ad59-e8933ef09115",
  "hydrophone_name": "Orcasound Lab",
  "species": "ar-v2-promoted",
  "start_timestamp": 1711929600,
  "end_timestamp": 1711936800,
  "hints": "Scroll the timeline view to the time 02:05 and then zoom into the 15m, 5m, and 1m zoom levels. Select \"Vocalizations\" to see trained model predicted humpback call types. Select \"Detections\" to see model predicted whale/not-whale time windows. Click the play button to listen to the hydrophone recording."
}
```

## Routes

- `/` loads the timeline registry from `data/index.json`
- `/:jobId` loads the job viewer from `data/{jobId}/manifest.json`

## Commands

| Command | Description |
|---------|-------------|
| `TIMELINE_EXPORT_ROOT=... pnpm dev:timeline` | Start the viewer against a local export root |
| `pnpm typecheck` | Run TypeScript checks across all workspace packages |
| `pnpm build` | Build all packages |
| `pnpm test` | Run the frontend Vitest suite |
| `pnpm test:ui` | Run the Playwright layout and resize suite |
| `pnpm test:ui:visual` | Run the curated Playwright screenshot baseline suite |
| `TIMELINE_EXPORT_ROOT=... pnpm test:ui:smoke` | Run the Playwright smoke suite against a real export root |
| `pnpm cdk:synth` | Synthesize the viewer stack |
| `pnpm cdk:diff` | Diff the viewer stack |
| `pnpm cdk:deploy` | Deploy the viewer stack |
| `pnpm deploy:viewer` | Run the full viewer deploy/redeploy helper |
| `pnpm publish:viewer:app` | Upload the frontend bundle to the app bucket |
| `pnpm publish:viewer:data -- --path <export-root>` | Upload one export root to the data bucket |
| `pnpm upload:viewer:missing -- --dry-run` | Compare local export data with the deployed data bucket |
| `pnpm --filter @humpback/frontend test:ui:update` | Refresh the visual baseline snapshots intentionally |

## Testing

- `pnpm test` covers the timeline contract plus viewport utility behavior.
- `pnpm test:ui` builds the app, serves it through `vite preview`, mounts the
  committed fixture in `frontend/test-data/timeline-export/`, and exercises
  viewer layout and resize behavior through Playwright.
- `pnpm test:ui:visual` runs the curated screenshot baseline set against that
  same committed fixture. The committed baselines currently target macOS
  Chromium.
- `pnpm test:ui:smoke` is an opt-in local smoke lane for a real export root.
- `pnpm typecheck` and `pnpm build` are the baseline verification gates for
  meaningful changes.

## Deployment

The active deployment path is viewer-only:

- primary stack region: `us-west-2`
- public entry point: one CloudFront distribution
- app hosting: private S3 app bucket
- timeline data hosting: private S3 data bucket

CloudFront serves the SPA shell from the app bucket and exposes export data at
`/data/*` from the data bucket. The browser contract stays `/data/*`, while the
bucket stores the export root directly as `index.json` plus job folders.

### Deploy the stack

Copy `.env.deploy.example` to `.env.deploy`, or export the same variables in
your shell.

Preferred workflow:

```bash
pnpm deploy:viewer -- --dry-run
pnpm deploy:viewer
```

The deploy helper loads `.env.deploy` when present, runs `pnpm cdk:synth`,
checks whether the viewer stack already exists, deploys only when needed,
resolves stack outputs, publishes the frontend bundle, and verifies deployed
data parity against the local export root.

Minimum inputs:

- `AWS_REGION=us-west-2`
- optional bucket-name overrides through
  `STATIC_VIEWER_APP_BUCKET_NAME` and `STATIC_VIEWER_DATA_BUCKET_NAME`

Optional custom-domain inputs:

- `STATIC_VIEWER_DOMAIN_NAME`
- `STATIC_VIEWER_CERTIFICATE_ARN`
- `STATIC_VIEWER_HOSTED_ZONE_ID`
- `STATIC_VIEWER_HOSTED_ZONE_NAME`

CloudFront certificates must still live in `us-east-1`.

### Publish the viewer bundle

```bash
STATIC_VIEWER_APP_BUCKET_NAME=... \
STATIC_VIEWER_DISTRIBUTION_ID=... \
pnpm publish:viewer:app
```

### Publish timeline export data

```bash
STATIC_VIEWER_DATA_BUCKET_NAME=... \
STATIC_VIEWER_DISTRIBUTION_ID=... \
pnpm publish:viewer:data -- --path /path/to/export/root
```

### Data parity verification

`pnpm deploy:viewer` verifies that the deployed data bucket matches the local
export root. The verification fails when:

- local files are missing remotely
- remote files exist that are not present locally
- object sizes differ
- JSON files differ in content

When that happens:

```bash
pnpm upload:viewer:missing -- --dry-run
pnpm upload:viewer:missing
```

If the verification reports extra remote keys, remove those stale S3 objects
before rerunning `pnpm deploy:viewer`.

Useful deploy-helper overrides:

```bash
pnpm deploy:viewer -- --path /path/to/export/root
pnpm deploy:viewer -- --skip-data
pnpm deploy:viewer -- --allow-dirty
```

## Environment Variables

Copy `.env.local.example` to `.env.local` to customize local development.

| Variable | Default | Description |
|----------|---------|-------------|
| `TIMELINE_EXPORT_ROOT` | unset | Local directory mounted at `/data` |
| `FRONTEND_PORT` | `6173` | Frontend dev-server port |
| `AWS_REGION` | `us-west-2` | AWS region used by deployment tooling |

See `.env.deploy.example` for the full deployment variable set.

## Project Structure

```text
frontend/
  src/
    pages/        # Landing page and timeline viewer routes
    components/   # Timeline UI components
    api/          # Timeline registry and manifest loaders
    lib/          # Contract, math, cache, and rendering utilities
  test-data/      # Committed real-derived timeline fixture
  tests/ui/       # Playwright viewer coverage
cdk/              # CloudFront + S3 viewer stack
scripts/          # Deploy and publish helpers
```
