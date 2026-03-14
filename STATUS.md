# Project Status

Current state of the Humpback Annotation App repository.

---

## Phase

Bootstrap and architecture definition.

## Implemented In This Repository

- V1 product and architecture spec in
  `whale_annotation_v1_architecture_spec.md`
- technical design pack in `technical_high_level_design_pack.md`
- local development stack notes in `whale_annotation_local_development_stack.md`
- DynamoDB schema notes in `dynamodb_schema_design.md`
- DynamoDB query patterns in `dynamodb_query_cookbook.md`
- repo coordination files: `AGENTS.md`, `CLAUDE.md`, `DECISIONS.md`,
  `MEMORY.md`, `PLANS.md`, and `STATUS.md`
- `pnpm` workspace bootstrap covering `frontend/`, `api/`, `cdk/`,
  `scripts/`, and `tests/`
- Node 22 pinning via `.nvmrc` and `.node-version`
- shared TypeScript baseline in `tsconfig.base.json`
- placeholder package scripts for `dev`, `typecheck`, `build`, `test`,
  `db:local:init`, `db:local:seed`, and `cdk:synth`

## Not Yet Implemented

- frontend application code
- backend/API handlers
- infrastructure code
- working local bootstrap scripts
- database/table creation logic
- seed data loader implementation
- authentication integration
- real tests and CI
- deployment pipeline

## Planned Capabilities

### User-facing V1

- browse whale vocalization samples by folder
- preview short audio clips
- view pre-rendered spectrogram images
- submit and update one label per sample per user
- filter labeled versus unlabeled samples
- request a suggested next unlabeled sample
- reveal aggregate percentages after the current user labels a sample

### Admin V1

- inspect labels by user, sample, folder, category, and date range
- export reporting data

### Platform V1

- CDN-served static web app and media
- authenticated API for catalog, annotation, suggestion, and reporting
- DynamoDB-backed catalog and labels data model
- local development using DynamoDB Local, local media, and local API emulation
- cloud deployment via infrastructure-as-code

## Current Source of Truth

Use these docs as the current authoritative references:

- `whale_annotation_v1_architecture_spec.md`
- `technical_high_level_design_pack.md`
- `whale_annotation_local_development_stack.md`
- `dynamodb_schema_design.md`
- `dynamodb_query_cookbook.md`
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`

## Known Constraints and Guardrails

- optimize for low idle cost first
- keep west-coast user experience roughly in the 500-1000 ms range
- media files are public assets, not proxied through application compute
- V1 uses pre-rendered spectrogram images
- no relational database dependency is planned for V1
- local development should avoid a heavyweight fake-AWS environment
- aggregate percentages stay hidden until a user labels the sample
- one current label per sample per user remains a core product rule
