# session-begin

Start of every non-trivial session. Normalize repo state, load the current
project context, and decide whether the next step is planning, implementation,
or debugging.

## Steps

1. **Check repo state**
   - Record the current branch and `git status --porcelain`
   - If `HEAD` is detached, stop and report it
   - If the working tree is dirty, summarize the changed files and preserve
     them; do not reset, stash, or overwrite anything implicitly

2. **Normalize onto `main` for fresh work**
   - If starting fresh and the tree is clean, switch to `main`
   - If `origin` exists, fast-forward local `main` from `origin/main`
   - If fast-forward fails, stop and report rather than merging or rebasing

3. **Read context files**
   - `CLAUDE.md` for project rules, commands, and verification expectations
   - `STATUS.md` for what is actually implemented right now
   - `DECISIONS.md` for accepted architecture decisions
   - `README.md` for current local setup and runtime behavior
   - `MEMORY.md` when the task touches API shape, DynamoDB, media delivery, or
     local development behavior

4. **Check for active work**
   - Look for local `feature/*` branches
   - Look for repo-local plans in `docs/plans/`
   - Look for specs in `docs/specs/`
   - Note any repo-local plan or spec that matches the request

5. **Summarize the project state**
   - What the app currently does versus what is still planned
   - Any active plan or in-progress branch that matches the request
   - Recent commits on `main`
   - Known constraints or workflow notes that affect the task

6. **Clarify the next action**
   - Significant feature, workflow, schema, or architecture change:
     design and/or `session-plan`
   - Small fix or scoped docs update with clear requirements:
     `session-implement`
   - Bug discovered during verification or manual testing:
     `session-debug`

## Does NOT

- Create a feature branch
- Start implementation work
- Rewrite or discard the user's existing local changes

## Output

Summary of repo state plus the next recommended workflow step.

## Next Step

- New feature or substantial change: design, then `session-plan`
- Resuming existing planned work: `session-implement`
- Bug found during testing: `session-debug`
