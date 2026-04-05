# session-end

Finish a reviewed task by pushing the branch, creating or updating a PR, and
returning to a clean `main` when the workflow is feature-branch based.

## Preconditions

- `session-review` passed with `Ready for session-end: yes`, or the user has
  explicitly invoked `session-end` with no unresolved automated verification
  failures
- A direct user invocation of `session-end` counts as approval and confirmation
  that the work is unblocked and that any intended manual verification is
  already complete unless the user explicitly says not to merge
- On a `feature/*` branch, unless the user explicitly requested direct work on
  `main`

## Steps

1. **Gate check**
   - Verify there are no unresolved review findings or failed required
     automated checks
   - If files changed since the review, re-check the changed scope before
     continuing
   - Do not stop for additional smoke-test or manual-verification requests
     after an explicit user invocation of `session-end`

2. **Commit remaining reviewed changes**
   - If uncommitted changes remain, stage only the reviewed scope
   - Do not use broad destructive staging or cleanup commands

3. **Push the working branch**
   - `git push -u origin <branch>` if this is the first push
   - `git push` otherwise

4. **Create or reuse a pull request**
   - Check for an existing PR on the branch first
   - If none exists, create one targeting `main`
   - Include a short summary and verification commands

5. **Merge by default**
   - Treat `session-end` as authorization to complete the merge flow
   - Prefer squash merge for a clean history
   - If branch protections, conflicts, or permissions block the merge, report
     the blocker instead of forcing around it
   - If merge succeeds, continue to the cleanup steps

6. **Return to clean `main`**
   - `git checkout main`
   - `git pull --ff-only origin main` when `origin` exists
   - Delete the local feature branch after merge if it is safe to do so

7. **Handle direct-to-main exceptions carefully**
   - If the task was intentionally performed on `main`, do not invent a PR-only
     requirement
   - Report the final status clearly instead

## Does NOT

- Force-push
- Bypass review gates
- Rewrite history unless explicitly requested

## Output

PR URL or final branch status, plus confirmation that local `main` is clean
when that return step was performed.
