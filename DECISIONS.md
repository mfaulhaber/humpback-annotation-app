# Architecture Decision Log

Append-only record of significant architecture and implementation decisions.
Do not rewrite historical entries once they are accepted; add a new ADR instead.

---

## ADR-001: Use a pnpm Workspace With Node 22 and a Shared TypeScript Baseline

**Date**: 2026-03-14
**Status**: Accepted

**Context**: The repository moved from design-only documents into an initial
bootstrap phase and needed concrete dependency-management and TypeScript
choices. The design docs already implied a multi-package repo shape with
`frontend/`, `api/`, `cdk/`, `scripts/`, and `tests/`, but no package manager,
Node version, or TypeScript baseline had been committed yet.

**Decision**: Use a root `pnpm` workspace, pin the repository to Node 22 LTS,
and install shared TypeScript tooling at the repository root. Keep framework
selection for the frontend and concrete runtime dependencies for API and CDK
out of scope for this decision.

**Consequences**:
- Dependency installation is centralized in one lockfile and one workspace
  layout.
- Root tooling commands now exist for `dev`, `typecheck`, `build`, `test`,
  `db:local:init`, `db:local:seed`, and `cdk:synth`.
- Future implementation work should add runtime dependencies to the appropriate
  workspace package rather than the repository root.
- If the team later changes package manager or Node baseline, record that as a
  new ADR rather than rewriting this entry.

Use this template for future decisions:

## ADR-XXX: Decision Title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Superseded

**Context**: Why this decision is needed.

**Decision**: What was chosen.

**Consequences**:
- Impact on architecture
- Impact on implementation
- Follow-up work or migration notes
