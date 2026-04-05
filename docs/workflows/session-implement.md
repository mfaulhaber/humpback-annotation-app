# session-implement

Work through the planned scope, verify the change, and prepare a focused,
reviewable implementation diff.

## Preconditions

- On the intended working branch for the task
- A repo-local plan exists in `docs/plans/` for non-trivial work, or the task
  scope is already clear for a small fix

## Steps

1. **Confirm branch and scope**
   - Verify you are not accidentally editing unrelated work
   - Read the relevant plan or restate the small-task scope in one sentence

2. **Identify affected files before editing**
   - Read the existing API, frontend, scripts, and docs involved in the change

3. **Check project rules before changing core behavior**
   - Preserve one current label per sample per user
   - Keep aggregate percentages hidden until the current user has labeled the
     sample
   - Keep media delivery URL-based; do not proxy bytes through the app without
     an explicit decision
   - Preserve spectrogram nullability and real-data ingestion semantics unless
     the change intentionally updates them
   - Read `DECISIONS.md` and `MEMORY.md` before changing DynamoDB attributes,
     indexes, query patterns, or local stack behavior

4. **Implement tasks sequentially**
   - Keep changes focused
   - Prefer extending existing modules over introducing new abstractions without
     a clear need
   - If DynamoDB attributes, indexes, or item shapes change, update
     `scripts/src/db-local-init.ts` and `MEMORY.md`
   - If workflow conventions change, update `CLAUDE.md`, `AGENTS.md`,
     `docs/workflows/`, `.claude/commands/`, and the session skills together

5. **Add or update automated tests when relevant**
   - Extend frontend package tests when active timeline viewer logic changes
   - Extend `tests/src/api-integration.test.ts` or nearby test files when
     dormant API, auth, or aggregate behavior changes
   - Add targeted package tests when new logic makes that practical

6. **Run verification gates**
   - `pnpm typecheck`
   - `pnpm build`
   - `pnpm test` when the touched active frontend or isolated package logic is
     covered
   - `pnpm test:legacy` when the touched dormant API, auth, or data behavior
     is covered and the required local services are available
   - Re-run the relevant manual smoke path only when automated coverage is
     unavailable or incomplete

7. **Fix verification failures**

8. **Update docs and memory files**
   - `STATUS.md` for implemented behavior or constraint changes
   - `MEMORY.md` for data model, query pattern, or local-stack reference changes
   - `PLANS.md` when plan status or scope changes
   - `DECISIONS.md` for significant new architecture decisions

9. **Prepare a focused implementation diff**
   - Keep the eventual commit scope batched and reviewable for
     `session-review`

## Rules

- Prefer editing existing files over creating new ones without need
- Do not refactor unrelated code
- Do not quietly change annotation semantics, DynamoDB access patterns, or
  media-delivery assumptions without documenting that intent
- If `pnpm test` or `pnpm test:legacy` cannot be run when relevant, state
  exactly why and what was verified instead

## Does NOT

- Push to remote
- Open or update a PR
- Commit or merge the change set
- Merge branches

## Output

Working change implemented and verified on the working branch.

## Next Step

More `session-debug` if needed, then `session-review`.
