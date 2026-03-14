# Humpback Annotation App

## 1. Purpose

This project is the planned implementation of a low-cost whale annotation web
application for registered users. V1 should let users:

- browse whale vocalization samples by folder
- preview short audio clips
- view pre-rendered spectrogram images
- submit one label per sample per user
- see aggregate percentages only after submitting their own label
- filter labeled vs unlabeled samples
- optionally request a suggested next unlabeled sample

The architecture and data model are documented in the existing design files.
This repository currently contains planning documents only, so always separate
planned architecture from implemented state.

## Memory Files

| File | When to read |
|------|-------------|
| `MEMORY.md` | Working on entities, query patterns, DynamoDB design, or local dev |
| `DECISIONS.md` | Before changing architecture or implementation direction |
| `STATUS.md` | At session start; confirms what is actually implemented |
| `PLANS.md` | At session start; shows active and backlog work |
| `AGENTS.md` | Codex entry point and quick-start guidance |

---

## 2. Current Repository State

- The repo is in a planning/specification phase.
- The committed source of truth today is the design documentation, not app code.
- No production application scaffold has been committed yet.
- Changes should keep docs internally consistent and clearly mark what is
  planned versus what is already built.

---

## 3. Product Rules

1. One current label per sample per user.
2. Aggregate percentages stay hidden until that user has labeled the sample.
3. Users may browse samples without labeling first.
4. The system may suggest the next unlabeled sample.
5. Media files are public and should be served from storage/CDN.
6. Spectrograms are pre-rendered static assets in V1.

---

## 4. Architecture Guardrails

### 4.1 Cost and Deployment Model

- Optimize for low idle cost first.
- Favor a serverless deployment shape for V1.
- Keep local development possible without deploying to AWS.
- Infrastructure should remain compatible with infrastructure-as-code.

### 4.2 Media Delivery

- Media bytes should not pass through application compute unless a deliberate
  decision changes that.
- APIs should return metadata and media URLs, not proxy audio or image content.
- Audio clips and spectrograms remain storage-backed assets.

### 4.3 Annotation Data Model

- Preserve a unique current label for each `(sample_id, user_id)` pair.
- Maintain sample-level aggregate counts for fast reads after labeling.
- Percentages should be derived from counts in the API layer unless a decision
  explicitly changes that model.
- Keep browse/catalog data and annotation state logically separate.

### 4.4 Truthfulness and Docs Hygiene

- Do not present planned endpoints, tables, stacks, or workflows as implemented
  if they are only described in docs.
- When changing architecture, API behavior, schema, workflows, or repo
  conventions, update `CLAUDE.md`, `MEMORY.md`, `STATUS.md`, `PLANS.md`, and
  `DECISIONS.md` as appropriate.
- Record significant architecture choices in `DECISIONS.md` as append-only ADRs.

---

## 5. Planned High-Level Architecture

The V1 design currently points to:

1. Static web app served via CDN
2. Public media storage for audio and spectrograms
3. Authenticated API layer
4. Catalog service
5. Annotation service
6. Suggest-next service
7. Admin/reporting service
8. Catalog datastore
9. Labels datastore
10. Managed identity/authentication

The technical design pack also assumes local development via a frontend dev
server, local API emulation, DynamoDB Local, and a local media folder.

---

## 6. Planned API Surface

Conceptual V1 endpoints from the current design docs:

- `GET /folders`
- `GET /folders/{folderId}/samples`
- `GET /samples/{sampleId}`
- `GET /samples/suggest-next`
- `PUT /samples/{sampleId}/label`
- `GET /admin/labels`

Keep implementation work aligned with those flows unless a new ADR updates the
surface.

---

## 7. Planned Local Development Direction

Local development should:

- run the application without requiring AWS deployment
- use DynamoDB Local for realistic DynamoDB semantics
- use a local media folder in place of cloud object storage
- support local API emulation from synthesized infrastructure templates
- use a lightweight stack rather than a full fake cloud

Expected local components from the current docs:

- DynamoDB Local
- CDK-generated infrastructure templates
- SAM CLI or equivalent local Lambda/API emulation
- frontend dev server
- simple dev-auth headers for local user simulation

---

## 8. Change Management

- If a change makes a previously tentative choice concrete, reflect that in
  `STATUS.md`.
- If a choice closes an open architectural direction, log it in
  `DECISIONS.md`.
- If implementation starts, expand these docs to include real repo commands,
  layouts, and verification steps rather than leaving them conceptual.
