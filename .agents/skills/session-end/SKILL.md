---
name: session-end
description: Checklist for completing a work session — commits, pushes, creates PR, and attempts squash merge.
---

## Steps

1. **Confirm review gate** — session-review must have concluded with **"Ready for session-end: yes"**. If not, stop and route to `/session-review` first.

2. **Confirm git safety**:
   - Run `git branch --show-current` — if on a protected branch (`main`), stop and report. Do not commit directly to a protected branch.
   - Run `git status --porcelain` to see uncommitted changes.

3. **Summarize work completed** — what changed and why (1-3 bullets).

4. **Update STATUS.md** if:
   - New capabilities were added
   - Known constraints changed
   - Schema version changed (new DynamoDB attributes/indexes)

5. **Update PLANS.md** if:
   - An active plan was completed (move to Completed)
   - New backlog items were identified
   - A plan's scope changed

6. **Append to DECISIONS.md** if:
   - A significant architecture decision was made during this session

7. **Re-check review status** — if steps 4-6 modified any files, re-run `/session-review` to validate doc edits before committing. Wait for **"Ready for session-end: yes"** again.

8. **Prepare commit scope**:
   - Do NOT use `git add -A` or `git add .`
   - Collect the reviewed file list from session-review's modified-file scope
   - Stage only reviewed files with `git add <file1> <file2> ...`
   - Double-check staged files with `git diff --cached --name-only`

9. **Create session commit**:
   - Write a concise commit message summarizing the session's changes
   - Use a conventional commit style (e.g., `feat:`, `fix:`, `docs:`, `chore:`)
   - Include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

10. **Push the branch**:
    - Run `git push -u origin <branch-name>`
    - If push fails, report the error — do not force-push

11. **Handle PR**:
    - Check for an existing open PR from this branch: `gh pr list --head <branch-name> --state open`
    - If no PR exists, create one: `gh pr create --title "<plan title>" --body "<summary>"`
    - Use the plan title as the PR title; include the session summary in the body
    - If a PR already exists, report its URL

12. **Attempt squash merge**:
    - Try `gh pr merge --squash --auto`
    - If merge fails (policy, checks, conflicts), report the blocker — do not bypass branch protection or force merge
    - If merge succeeds, report it

13. **Report next steps** — what should the next session pick up?

## Rules
- Keep updates concise
- Don't rewrite entire files — use targeted edits
- Verify memory files are consistent with each other
- Do NOT force-push, bypass branch protection, or skip CI checks
- Do NOT commit if session-review gate was not passed
