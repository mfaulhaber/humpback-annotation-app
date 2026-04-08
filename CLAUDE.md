# Humpback Timeline Viewer

## 1. Purpose

This project's active MVP is a low-cost whale timeline viewer that renders
exported acoustic jobs from same-origin static artifacts. The active frontend
should let users:

- browse available exported timelines from a landing page
- open one job in a timeline viewer route
- inspect pre-rendered spectrogram tiles across multiple zoom levels
- play chunked audio in sync with the centered playhead
- review confidence, detections, and vocalization overlays
- work locally against exported artifacts without requiring API mediation

The repository still contains the earlier annotation application and its API,
but that work is dormant in the active UI. When touching legacy annotation
code, preserve its label and aggregate semantics unless the change explicitly
updates them. Always distinguish clearly between what exists today and what is
still planned.

For Codex workflow guidance, see `AGENTS.md`.

---

## 2. High-Level Architecture

Components:
1. React 19 + Vite frontend in `frontend/` for the active timeline viewer
2. Same-origin exported artifacts under `/data/*` in local dev and intended
   CloudFront/S3 deployment
3. Dormant Fastify API in `api/` with a shared app entry point for local dev
   and a Lambda adapter stub
4. Dormant DynamoDB-backed catalog and labels access layers under
   `api/src/data/`
5. Local tooling in `scripts/` for dev orchestration, table init, seed data,
   real-data ingestion for the legacy stack, and viewer publish helpers
6. Vitest frontend coverage in `frontend/` for the active timeline viewer plus
   legacy integration coverage in `tests/` for the dormant API path
7. Viewer-only CloudFront/S3 infrastructure code in `cdk/`
8. Local or external media served from `local_media/` or `MEDIA_ROOT`

Current non-implemented areas include timeline label editing, production auth
integration for the legacy stack, CI/CD, and automated certificate provisioning
for custom domains.

---

## 3. Core Development Rules

### 3.1 Package Management and Commands
- Use `pnpm` for package management in this repo.
- Keep the repo pinned to Node 22 unless a new decision changes that baseline.
- Commit `pnpm-lock.yaml` whenever dependencies change.
- Use these commands for normal development:
  - Install dependencies: `pnpm install`
  - Start the active timeline viewer: `TIMELINE_EXPORT_ROOT=... pnpm dev:timeline`
  - Start the full local stack: `pnpm dev`
  - Start with seed data: `pnpm dev --seed`
  - Start with real-data ingest: `MEDIA_ROOT=... pnpm dev --ingest <path>`
  - Run type checks: `pnpm typecheck`
  - Build all packages: `pnpm build`
  - Run active frontend tests: `pnpm test`
  - Run active viewer browser layout tests: `pnpm test:ui`
  - Run active viewer browser visual baselines: `pnpm test:ui:visual`
  - Run active viewer real-data smoke tests:
    `TIMELINE_EXPORT_ROOT=... pnpm test:ui:smoke`
  - Run legacy API integration tests: `pnpm test:legacy`
  - Initialize DynamoDB Local tables: `pnpm db:local:init`
  - Seed DynamoDB Local: `pnpm db:local:seed`
  - Ingest real data: `pnpm db:ingest -- --path <dir>`
  - Synthesize the viewer stack: `pnpm cdk:synth`
  - Diff the viewer stack: `pnpm cdk:diff`
  - Deploy the viewer stack: `pnpm cdk:deploy`
  - Run the smart viewer deploy/redeploy flow: `pnpm deploy:viewer`
  - Publish the viewer app bundle: `pnpm publish:viewer:app`
  - Publish timeline export data: `pnpm publish:viewer:data -- --path <dir>`

### 3.2 Annotation and Data Rules
- Preserve a unique current label for each `(sample_id, user_id)` pair when
  touching the dormant annotation stack.
- Keep aggregate percentages hidden until the current user has labeled the
  sample when touching the dormant annotation stack.
- Treat label writes and aggregate maintenance as one logical transaction.
- Keep browse/catalog data and annotation state logically separate.
- `suggest-next` should continue to return only unlabeled candidates within the
  active folder unless the change intentionally redefines that behavior.

### 3.3 Media and Ingestion Rules
- Active timeline viewer data is fetched from same-origin `/data/*` paths.
- Media delivery should remain URL-based. APIs return media URLs, not media
  bytes.
- Audio clips and spectrograms are storage-backed assets in both local and
  planned deployed environments.
- `spectrogramKey` and `spectrogramUrl` must remain nullable across the stack.
- Real-data ingest expects dataset folders under
  `[root]/positives/humpback/<dataset>/YYYY/MM/DD/` with co-located audio files
  and optional PNG spectrograms.
- If media-key semantics, folder parsing, or sample-ID generation change, update
  the relevant docs in the same change.

### 3.4 API, DynamoDB, and Local Dev Practices
- Read `DECISIONS.md` and the relevant existing docs or implementation before
  changing DynamoDB attributes, indexes, query patterns, or local stack
  behavior.
- Keep local timeline viewing possible without API or DynamoDB when exported
  artifacts are available.
- If DynamoDB table attributes or indexes change, update
  `scripts/src/db-local-init.ts` and any affected repo docs; add an ADR in
  `DECISIONS.md` when the change is architecturally significant.
- Preserve dev-auth behavior locally unless the task explicitly changes it.
- Keep local development possible without deploying to AWS.

### 3.5 Documentation and Planning
- Update the relevant docs when behavior, workflow, architecture, data model,
  or implementation details change:
  - `CLAUDE.md` for project rules and verification expectations
  - `AGENTS.md` for Codex workflow guidance
  - `README.md` for user-facing setup and runtime behavior
  - `DECISIONS.md` for append-only architecture decisions
  - `docs/workflows/` for session workflow steps
  - `docs/plans/` for repo-local implementation plans and planning history
  - `docs/specs/` for design specs on significant work
- Implementation plans should live in `docs/plans/`.
- Keep `.claude/commands/` and `docs/workflows/` in sync.
- When a task uses a `feature/*` branch, `session-end` should rename the
  conversation to that branch name before returning to `main` so thread history
  stays tied to the implemented work.

### 3.6 Verification
- Baseline verification for meaningful changes:
  - `pnpm typecheck`
  - `pnpm build`
- Run `pnpm test` when the touched active frontend or isolated package logic is
  covered.
- Run `pnpm test:ui` when the touched active frontend behavior depends on real
  browser layout, resize handling, or same-origin route-level viewer behavior
  covered by the Playwright suite.
- Run `pnpm test:ui:visual` when the touched active frontend behavior changes a
  curated screenshot-covered viewer layout or visual baseline and the
  committed baseline environment is available.
- Run `pnpm test:legacy` when the touched dormant API, auth, or data behavior
  is covered and the required local services are available.
- Run `pnpm test:ui:smoke` only when you intentionally want a local check
  against a real external export root and one is available.
- If a change requires manual verification because automated coverage is missing
  or unavailable, state exactly what was verified and what was not run.
- A direct user invocation of `session-end` counts as confirmation that any
  intended manual verification has already been handled; do not block that
  finish step on additional smoke-test requests.
- Do not claim coverage you did not execute.

---

## 4. Core Design Principles

### 4.1 Implemented-vs-Planned Truthfulness
Do not present planned endpoints, stacks, auth flows, or deployment workflows as
implemented if they only exist in docs.

### 4.2 Low Idle Cost First
Keep the V1 direction compatible with a low-idle-cost, serverless deployment
shape.

### 4.3 URL-Based Media Delivery
Media bytes should not pass through application compute unless an explicit
decision changes that rule.

### 4.4 Annotation Integrity
Preserve one-label-per-user semantics and correct aggregate behavior even when
relabeling.

### 4.5 Local Development Parity
Local development should remain useful without cloud deployment and should stay
aligned with the real API/data model where practical.

---

## 5. Testing and Validation Requirements

This repo includes TypeScript checks, package builds, a frontend Vitest suite
for timeline utilities, a Playwright browser suite for the active timeline
viewer against a committed real-derived fixture plus an optional real-export
smoke lane, and a legacy integration suite for the dormant API path.

Every meaningful change should include:
- `pnpm typecheck`
- `pnpm build`
- `pnpm test` when the touched active frontend behavior is covered
- `pnpm test:ui` when the touched active frontend behavior depends on browser
  layout, resize, or route-level viewer execution covered by the Playwright
  suite
- `pnpm test:ui:visual` when screenshot-covered viewer visuals intentionally
  change or need regression confirmation and the committed baseline
  environment is available
- `pnpm test:legacy` when the touched dormant API or data behavior is covered
  and the local stack is available
- `pnpm test:ui:smoke` only when a real external export-root smoke run is
  relevant and available
- Targeted manual verification for changed viewer interactions that are not yet
  credibly covered by the frontend suite when the user or implementer chooses
  to perform it

When a change introduces substantial API, data-access, or aggregate logic,
prefer adding or extending automated tests as part of the same change.

---

## 6. Definition of Done

A change is done only if:
- The requested behavior is implemented
- `pnpm typecheck` passes
- `pnpm build` passes
- `pnpm test` is run when appropriate, or the exact verification gap is called
  out
- `pnpm test:ui` / `pnpm test:ui:visual` are run when appropriate for the
  touched active frontend behavior and available baseline environment, or the
  exact verification gap is called out
- Relevant documentation is updated
- Core annotation, media-delivery, and implemented-vs-planned rules are still
  preserved

---

## 7. Non-Goals

Current non-goals for this repo:
- Proxying media bytes through the API by default
- Replacing DynamoDB with a relational database in V1
- Pretending CDK deployment, Cognito auth, or CI/CD are already implemented
- Hiding workflow or architecture changes without updating the relevant repo
  docs

---

## 8. Project Reference

### 8.1 Core Reference Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Codex workflow entry point |
| `README.md` | Current setup and runtime behavior |
| `DECISIONS.md` | Append-only architecture decision log |
| `docs/workflows/` | Session workflow definitions |
| `docs/plans/` | Repo-local implementation plans and planning history |
| `docs/specs/` | Design specs for significant work |

### 8.2 Technology Stack

| Layer | Technology |
|-------|-----------|
| Package Manager | pnpm 10 |
| Runtime | Node 22 |
| API | Fastify 5 with `@fastify/aws-lambda` adapter stub |
| Frontend | React 19 + Vite 8 |
| Data Store | DynamoDB Local in dev, DynamoDB-style schema in production plans |
| Testing | Vitest frontend tests, legacy Vitest integration tests, plus targeted manual smoke when needed |
| Infra Direction | CDK viewer stack implemented today, CI/CD and broader cloud rollout still planned |

### 8.3 Repository Layout

```text
humpback-annotation-app/
├── CLAUDE.md
├── AGENTS.md
├── README.md
├── DECISIONS.md
├── package.json
├── pnpm-lock.yaml
├── .claude/
│   └── commands/
│       ├── session-begin.md
│       ├── session-plan.md
│       ├── session-implement.md
│       ├── session-deploy.md
│       ├── session-debug.md
│       ├── session-review.md
│       └── session-end.md
├── docs/
│   ├── plans/
│   ├── specs/
│   └── workflows/
├── api/
├── frontend/
├── scripts/
├── tests/
├── cdk/
└── local_media/
```

### 8.4 Runtime Constraints

- `pnpm test` does not require local services
- `pnpm test:ui` and `pnpm test:ui:visual` build and preview the frontend
  against the committed fixture in `frontend/test-data/timeline-export/`
- the committed visual screenshot baselines currently target macOS Chromium
- `pnpm test:ui:smoke` expects `TIMELINE_EXPORT_ROOT` to point at a real export
  root
- `pnpm test:legacy` expects the local API and DynamoDB stack to be available
- `pnpm dev:timeline` expects `TIMELINE_EXPORT_ROOT` to point at a directory
  containing `index.json` and exported job folders
- `MEDIA_ROOT` defaults to `./local_media` but can point at a real data root
- Spectrograms are nullable; the UI and API must handle missing spectrograms
- Active viewer cloud deployment is implemented; production auth for the
  dormant legacy stack and broader automation remain planned work
