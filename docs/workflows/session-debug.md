# session-debug

Structured root-cause debugging for issues found during manual testing, review,
or integration verification. This step is repeatable and can be used as many
times as needed between implementation and final review.

## Preconditions

- On a working branch for the current task
- A reproducible symptom exists

## Steps

1. **Describe the symptom**
   - What is happening
   - What should be happening instead

2. **Reproduce minimally**
   - Find the smallest reproduction path: API request, integration test, or UI
     flow

3. **Read the relevant code**
   - Inspect the affected routes, data helpers, frontend code, or scripts before
     changing anything
   - Check recent commits when history might explain the regression

4. **Identify the root cause**
   - Explain why the bug occurs
   - Confirm the explanation against the code, not just intuition
   - Re-check `DECISIONS.md` and the relevant repo docs when the issue touches
     core data or workflow assumptions

5. **Implement the minimal fix**
   - Change only what is necessary to address the root cause

6. **Add regression coverage when appropriate**
   - If active timeline viewer logic regressed, extend the nearest frontend
     Vitest coverage
   - If dormant API, auth, or aggregate behavior regressed, extend
     `tests/src/api-integration.test.ts` when practical
   - If the bug lives in isolated package logic, add the nearest sensible test

7. **Run verification**
   - `pnpm typecheck`
   - `pnpm build`
   - `pnpm test` when the changed active frontend or isolated package logic is
     covered
   - `pnpm test:legacy` when the changed dormant API or data path is covered
     and required local services are available
   - Re-run the relevant manual smoke path only when automated coverage is not
     available

## Rules

- Do not ship workarounds that leave the root cause in place
- Do not refactor unrelated code while debugging
- Preserve one-label-per-user semantics, aggregate visibility rules, and
  URL-based media delivery unless the bug is specifically in those areas

## Does NOT

- Require a separate commit for each fix
- Push or open a PR

## Output

Minimal fix applied, verification rerun, and root cause explained.

## Next Step

More `session-debug` rounds if needed, or `session-review` once the behavior is
clean.
