# Humpback Annotation App

## 1. Purpose

This project is a low-cost whale annotation web application for registered
users. V1 should let users:

- browse whale vocalization samples by folder
- preview short audio clips
- view pre-rendered spectrograms when available
- submit one current label per sample per user
- see aggregate percentages only after submitting their own label
- filter labeled vs unlabeled samples
- request a suggested next unlabeled sample
- review labels in an admin flow

The repository now contains an implemented local skeleton app plus the design
docs for future AWS deployment. Always distinguish clearly between what exists
today and what is still planned.

For Codex workflow guidance, see `AGENTS.md`.

---

## 2. High-Level Architecture

Components:
1. React 19 + Vite frontend in `frontend/`
2. Fastify API in `api/` with a shared app entry point for local dev and a
   Lambda adapter stub
3. DynamoDB-backed catalog and labels access layers under `api/src/data/`
4. Local tooling in `scripts/` for dev orchestration, table init, seed data,
   and real-data ingestion
5. Vitest integration coverage in `tests/`
6. Future infrastructure code in `cdk/`
7. Local or external media served from `local_media/` or `MEDIA_ROOT`

Current non-implemented areas include production auth integration, deployed CDK
stacks, CI/CD, and the cloud delivery pipeline.

---

## 3. Core Development Rules

### 3.1 Package Management and Commands
- Use `pnpm` for package management in this repo.
- Keep the repo pinned to Node 22 unless a new decision changes that baseline.
- Commit `pnpm-lock.yaml` whenever dependencies change.
- Use these commands for normal development:
  - Install dependencies: `pnpm install`
  - Start the full local stack: `pnpm dev`
  - Start with seed data: `pnpm dev --seed`
  - Start with real-data ingest: `MEDIA_ROOT=... pnpm dev --ingest <path>`
  - Run type checks: `pnpm typecheck`
  - Build all packages: `pnpm build`
  - Run automated tests: `pnpm test`
  - Initialize DynamoDB Local tables: `pnpm db:local:init`
  - Seed DynamoDB Local: `pnpm db:local:seed`
  - Ingest real data: `pnpm db:ingest -- --path <dir>`
  - Synthesize infrastructure stubs: `pnpm cdk:synth`

### 3.2 Annotation and Data Rules
- Preserve a unique current label for each `(sample_id, user_id)` pair.
- Keep aggregate percentages hidden until the current user has labeled the
  sample.
- Treat label writes and aggregate maintenance as one logical transaction.
- Keep browse/catalog data and annotation state logically separate.
- Users may browse without labeling first.
- `suggest-next` should continue to return only unlabeled candidates within the
  active folder unless the change intentionally redefines that behavior.

### 3.3 Media and Ingestion Rules
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
- Read `DECISIONS.md` and `MEMORY.md` before changing DynamoDB attributes,
  indexes, query patterns, or local stack behavior.
- If DynamoDB table attributes or indexes change, update
  `scripts/src/db-local-init.ts`, `MEMORY.md`, and `STATUS.md`; add an ADR in
  `DECISIONS.md` when the change is architecturally significant.
- Preserve dev-auth behavior locally unless the task explicitly changes it.
- Keep local development possible without deploying to AWS.

### 3.5 Documentation and Planning
- Update the relevant docs when behavior, workflow, architecture, data model,
  or project status changes:
  - `CLAUDE.md` for project rules and verification expectations
  - `AGENTS.md` for Codex workflow guidance
  - `README.md` for user-facing setup and runtime behavior
  - `STATUS.md` for implemented behavior and constraints
  - `MEMORY.md` for stable reference material
  - `PLANS.md` for active/backlog tracking
  - `DECISIONS.md` for append-only architecture decisions
  - `docs/workflows/` for session workflow steps
  - `docs/plans/` for repo-local implementation plans
  - `docs/specs/` for design specs on significant work
- New detailed plans should live in `docs/plans/`. `PLANS.md` remains the
  high-level active/backlog tracker.
- Keep `.claude/commands/`, `.agents/skills/`, and `docs/workflows/` in sync.

### 3.6 Verification
- Baseline verification for meaningful changes:
  - `pnpm typecheck`
  - `pnpm build`
- Run `pnpm test` when the touched API, auth, data, or end-to-end behavior is
  covered and the required local services are available.
- If a change requires manual verification because automated coverage is missing
  or unavailable, state exactly what was verified and what was not run.
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

This repo includes TypeScript checks, package builds, and a Vitest integration
suite that targets a running local stack.

Every meaningful change should include:
- `pnpm typecheck`
- `pnpm build`
- `pnpm test` when the touched behavior is covered and the local stack is
  available
- A targeted manual smoke test only for changed behavior without credible
  automated coverage

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
- Relevant documentation is updated
- Core annotation, media-delivery, and implemented-vs-planned rules are still
  preserved

---

## 7. Non-Goals

Current non-goals for this repo:
- Proxying media bytes through the API by default
- Replacing DynamoDB with a relational database in V1
- Pretending CDK deployment, Cognito auth, or CI/CD are already implemented
- Hiding workflow or architecture changes without updating the memory files

---

## 8. Project Reference

### 8.1 Memory Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Codex workflow entry point |
| `STATUS.md` | Implemented behavior, capabilities, and current constraints |
| `PLANS.md` | Active work, backlog, and recently completed items |
| `DECISIONS.md` | Append-only architecture decision log |
| `MEMORY.md` | Stable reference material for entities, DynamoDB, and local dev |

### 8.2 Technology Stack

| Layer | Technology |
|-------|-----------|
| Package Manager | pnpm 10 |
| Runtime | Node 22 |
| API | Fastify 5 with `@fastify/aws-lambda` adapter stub |
| Frontend | React 19 + Vite 8 |
| Data Store | DynamoDB Local in dev, DynamoDB-style schema in production plans |
| Testing | Vitest integration tests plus targeted manual smoke when needed |
| Infra Direction | CDK stubs today, fuller stacks planned |

### 8.3 Repository Layout

```text
humpback-annotation-app/
├── CLAUDE.md
├── AGENTS.md
├── README.md
├── STATUS.md
├── PLANS.md
├── DECISIONS.md
├── MEMORY.md
├── package.json
├── pnpm-lock.yaml
├── .claude/
│   └── commands/
│       ├── session-begin.md
│       ├── session-plan.md
│       ├── session-implement.md
│       ├── session-debug.md
│       ├── session-review.md
│       └── session-end.md
├── .agents/
│   └── skills/
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

- `pnpm test` expects the local API and DynamoDB stack to be available
- `MEDIA_ROOT` defaults to `./local_media` but can point at a real data root
- Spectrograms are nullable; the UI and API must handle missing spectrograms
- Production auth and cloud deployment remain planned work
