# session-review

Validation gate that must pass before `session-end` can proceed.

## Steps

1. **Collect modified file scope**
   - Tracked changes: `git diff --name-only HEAD --diff-filter=ACMR`
   - Untracked files: `git ls-files --others --exclude-standard`
   - Review the combined scope
   - If the scope is empty, report that there are no modified files to review
     and stop

2. **Architecture and behavior checks**
   - Is there still only one current label per sample per user?
   - Are aggregate counts and percentages still hidden until the current user
     labels the sample?
   - Are label writes and aggregate maintenance still intentionally
     transactional?
   - Do APIs still return media URLs instead of proxying media bytes?
   - Are nullable spectrograms, dataset-folder semantics, and suggest-next
     behavior still intentional?
   - Are docs still truthful about what is implemented versus still planned?

3. **Completeness checks**
   - Are `CLAUDE.md`, `AGENTS.md`, `STATUS.md`, `MEMORY.md`, `PLANS.md`, or
     workflow docs updated where needed?
   - If DynamoDB schema or access patterns changed, were
     `scripts/src/db-local-init.ts`, `MEMORY.md`, and `DECISIONS.md` updated?
   - Is automated coverage added or explicitly deferred with a reason when new
     logic is substantial?
   - If `pnpm test` could not be run, is the missing coverage called out
     clearly?

4. **Run verification gates**
   - `pnpm typecheck`
   - `pnpm build`
   - `pnpm test` when the modified behavior is covered and required local
     services are available
   - Re-run manual smoke only for the relevant uncovered changed path

5. **Report findings**
   - Include file references and concrete risks where applicable

6. **Output verdict**
   - If all checks pass with no blocking findings:
     `Ready for session-end: yes`
   - Otherwise:
     `Ready for session-end: no`

## Rules

- If repo-tracked files change after this review, rerun `session-review`

## Does NOT

- Commit or push changes
- Open or update a PR
- Fix issues itself

## Output

Review verdict plus any blocking issues.

## Next Step

`session-end` if yes, otherwise fix issues and review again.
