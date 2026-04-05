# Humpback Annotation App — Codex Agent Instructions

`CLAUDE.md` is the authoritative project rulebook. Read it first.

## Codex Workflow

Follow these phases in order for non-trivial tasks. Each phase references a
workflow file in `docs/workflows/` with the detailed steps.

### Phase 1: Context (`docs/workflows/session-begin.md`)
- Read `CLAUDE.md`, `STATUS.md`, `PLANS.md`, and `DECISIONS.md`
- Read `README.md` for current setup and runtime behavior
- Read `MEMORY.md` when the task touches API shape, DynamoDB, media delivery,
  or local development behavior
- Check repo state, current branch, and any in-progress feature work

### Phase 2: Design
- For significant new features, workflow changes, schema changes, or
  architecture adjustments:
  - explore affected code and user flows
  - identify 2-3 approaches with trade-offs
  - write a design spec to `docs/specs/YYYY-MM-DD-<topic>-design.md`
  - do not commit the spec yet; Phase 3 handles that
- For small fixes or simple docs tweaks, skip directly to Phase 3 or Phase 4
  once scope is clear

### Phase 3: Plan (`docs/workflows/session-plan.md`)
- Create a feature branch `feature/<feature-name>` for non-trivial work
- Write an implementation plan to `docs/plans/YYYY-MM-DD-<feature>.md`
- Update `PLANS.md` so the active work points at the repo-local plan
- Commit the spec, plan, and `PLANS.md` update together as the first commit on
  the feature branch when those artifacts are newly created

### Phase 4: Implement (`docs/workflows/session-implement.md`)
- Work through plan tasks sequentially
- Keep one-label-per-user semantics, aggregate visibility rules, URL-based
  media delivery, and real-data ingestion behavior intact unless the change
  explicitly updates them
- Run the repo verification gates before finalizing implementation
- Keep the implementation scope batched so `session-review` and `session-end`
  can validate and commit one focused change set
- Update `STATUS.md`, `MEMORY.md`, `PLANS.md`, and `DECISIONS.md` when the
  change affects implemented behavior, workflows, data models, or architecture

### Phase 5: Debug (`docs/workflows/session-debug.md`)
- If manual testing or automated verification exposes issues, debug through
  structured root-cause analysis
- Apply minimal fixes
- Add regression coverage when a suitable test path exists

### Phase 6: Verify (`docs/workflows/session-review.md`)
- Run the verification gates defined in `CLAUDE.md`
- Review for annotation semantics, DynamoDB/documentation completeness, and
  implemented-vs-planned truthfulness
- End with an explicit verdict: `Ready for session-end: yes/no`

### Phase 7: Finish (`docs/workflows/session-end.md`)
- Push the feature branch
- Create or update a PR targeting `main`
- Treat a direct user invocation of `session-end` as approval and confirmation
  that the work is unblocked unless the user explicitly says not to merge
- Squash-merge the PR when mergeable
- If branch protections, required checks, conflicts, or permissions block the
  merge, report the blocker instead of forcing around it
- Return to a clean `main`

## Key Constraints

- Package manager: `pnpm` only
- Runtime baseline: Node 22 workspace with `frontend/`, `api/`, `scripts/`,
  `tests/`, and `cdk/`
- Do not describe planned infrastructure, Cognito integration, or deployment
  pipeline work as already implemented
- Media delivery remains storage/CDN style; APIs return media URLs instead of
  proxying bytes
- Preserve the core annotation rule: one current label per sample per user
- Aggregate percentages stay hidden until the current user has labeled the
  sample
- Verification baseline: `pnpm typecheck` and `pnpm build`
- Run `pnpm test` when the touched behavior is covered and required local
  services are available; if not, say exactly what was not run
- Keep `.claude/commands/`, `.agents/skills/`, and `docs/workflows/` aligned
