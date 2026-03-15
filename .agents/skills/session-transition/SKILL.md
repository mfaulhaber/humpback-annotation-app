---
name: session-transition
description: Checklist for transitioning from plan to implementation mode — activates plan, ensures feature branch, hands off to session-implement.
---

## Steps

1. **Activate current plan** — if the plan is not already in the Active section of `PLANS.md`, copy the plan path reference (e.g., `~/.claude/plans/[plan-file]`) into the Active section. Remove it from Backlog if present.

2. **Validate active plan reference** — read the Active section of `PLANS.md`, extract the plan file path, and confirm the linked plan file exists and is readable. If the link is broken or the file is missing, stop and report.

3. **Check git readiness**:
   - Determine the protected branch: try `git symbolic-ref refs/remotes/origin/HEAD` to get the default branch name; fall back to `main` if that fails.
   - Run `git status --porcelain` to check for uncommitted changes.
   - Run `git branch --show-current` to get the current branch.

4. **Enforce feature-branch readiness**:
   - **If on clean protected branch**: create a new feature branch named `codex/<slug>` where `<slug>` is a short kebab-case summary of the plan title (e.g., `codex/adapt-session-skills`). Run `git checkout -b codex/<slug>`.
   - **If on dirty protected branch**: stop and report — do not stash, commit, or discard changes on a protected branch.
   - **If already on a non-protected branch**: continue on the current branch (no action needed).

5. **Hand off to session-implement** — prompt the user to clear context and invoke `/session-implement` to begin implementation work.

## Rules
- Do NOT start coding or making changes in this skill
- Do NOT commit, push, or create PRs
- The only git-write operation allowed is `git checkout -b` to create a feature branch
