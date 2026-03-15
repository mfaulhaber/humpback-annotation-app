---
name: session-implement
description: Checklist for implementing planned changes safely.
---


## Steps

1. **Confirm implementation readiness**:
   - Read `PLANS.md` and validate that an active plan exists with a resolvable file path
   - Run `git branch --show-current` — if on a protected branch (`main`), stop and route to **session-transition** first
   - Run `git status --porcelain` — report any unexpected dirty state

2. **Restate the task** — confirm what you're building/fixing in one sentence from the active plan

3. **Identify affected files** — list files that need changes before editing

4. **Check DECISIONS.md** — verify no prior decision conflicts with the approach

5. **Implement with minimal diff**:
   - Read existing code before modifying
   - Change only what's necessary
   - Follow conventions in CLAUDE.md (pnpm, DynamoDB, testing)
   - If adding/changing DynamoDB attributes or indexes, update `db-local-init.ts` and document the change in `MEMORY.md`

6. **Run tests**: `pnpm test`

7. **Update documentation** (per CLAUDE.md section 8):
   - CLAUDE.md — if behavioral rules changed
   - MEMORY.md — if data models, workflows, or parameters changed
   - STATUS.md — if capabilities or constraints changed
   - DECISIONS.md — if a significant architecture decision was made (append new ADR)

8. **Verify** — re-run tests, confirm no regressions

9. **Hand off to session-review** — do NOT commit, push, or create PRs in this skill. Invoke `/session-review` to validate the changes before proceeding.

## Rules
- Prefer editing existing files over creating new ones
- Keep changes focused — don't refactor surrounding code
- Do NOT commit, push, or create PRs — that is handled by session-review and session-end
- Test before declaring done
