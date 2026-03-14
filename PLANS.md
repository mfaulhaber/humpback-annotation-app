# Development Plans

---

## Active

# Plan: Bootstrap the V1 Application From the Design Docs

Goal:

- turn the current architecture/specification set into an initial working repo
  scaffold without losing the low-cost serverless shape

Suggested milestones:

1. Choose and document the concrete implementation stack for frontend, API,
   infrastructure, and auth.
2. Scaffold the repo layout for app code, infrastructure, and local tooling.
3. Implement the catalog browse flows (`GET /folders`,
   `GET /folders/{folderId}/samples`, `GET /samples/{sampleId}`).
4. Implement label submission with aggregate maintenance and access control for
   post-label aggregate visibility.
5. Add local bootstrap tooling for DynamoDB tables, seed data, and media
   mounting.
6. Add admin reporting and suggest-next flows.

## Backlog

# Plan: Finalize Infrastructure and Deployment Shape

Focus:

- lock down the cloud deployment path
- codify environment configuration
- confirm local-to-cloud parity expectations

# Plan: Formalize API Contracts

Focus:

- define request/response schemas for browse, label, suggest-next, and admin
  reporting
- clarify pagination and filtering behavior
- document auth and role enforcement

# Plan: Seed Data and Developer Experience

Focus:

- local table creation
- seed dataset for UI work
- fast local start-up workflow

## Recently Completed

None yet. This repo is still in its clean bootstrap state.
