---
name: session-review
description: Systematic review checklist for changes before committing. Must pass before session-end.
---

## Checklist

1. **Architecture violations?**
   - One label per sample per user constraint preserved? (no duplicate labels)
   - Aggregate count consistency maintained? (label write + aggregate update transactional)
   - Media delivery not passing through application compute? (APIs return URLs, not bytes)
   - Aggregate percentages hidden until current user has labeled the sample?
   - Browse/catalog data and annotation state kept logically separate?

2. **Missing tests?**
   - Unit tests for new logic?
   - Integration tests for new/changed API endpoints?
   - Playwright tests for UI changes?

3. **Missing schema changes?**
   - New/changed DynamoDB attributes without updating `db-local-init.ts`?
   - New GSI or changed key schema without an ADR in `DECISIONS.md`?
   - MEMORY.md DynamoDB reference design up to date?

4. **Stale documentation?**
   - CLAUDE.md, MEMORY.md, STATUS.md reflect the changes?
   - New ADR needed in DECISIONS.md?

5. **Code quality?**
   - No security vulnerabilities (injection, XSS)?
   - No unnecessary complexity or over-engineering?
   - Follows project conventions (pnpm, TypeScript strict mode, workspace structure)?

6. **Collect modified review scope**:
   - Collect tracked working-tree changes with `git diff --name-only HEAD --diff-filter=ACMR`
   - Collect untracked files with `git ls-files --others --exclude-standard`
   - Review the union of those paths as the current modified-file scope
   - If the modified-file scope is empty, report "no modified files to review" and stop
   - Treat modified `.ts`/`.tsx` files under `api/src/`, `frontend/src/`, `scripts/src/`, `tests/src/`, and `cdk/` as TypeScript targets

7. **Run validation in order**:
   - TypeScript typecheck: if modified TypeScript targets exist, run `pnpm typecheck`
   - Tests: for any non-empty modified review scope, run `pnpm test`

## Output
- List any issues found with file:line references
- If no modified files are present, report that there is no review scope
- Confirm ready to commit only if typecheck and tests all pass
- End with an explicit gate: **Ready for session-end: yes** or **Ready for session-end: no** (with reasons)

## Rules
- Do NOT commit, push, or create PRs in this skill — that is session-end's job
- If validation fails, report the failures and set the gate to **no**
- Re-run this skill if files change after an initial review pass
