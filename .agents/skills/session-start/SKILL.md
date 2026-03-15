---
name: session-start
description: Checklist for starting every session by loading project context. Do NOT write code during this checklist.
---


## Steps

1. **Normalize repo onto local main**:
   - Record current branch (`git branch --show-current`) and working-tree state (`git status --porcelain`)
   - If HEAD is detached, stop and report — do not attempt recovery
   - If working tree is dirty (uncommitted changes), stop and report — do not stash, reset, or discard
   - Confirm local `main` branch exists; if not, stop and report
   - Switch to `main` (`git checkout main`)
   - Fetch origin (`git fetch origin main`)
   - Fast-forward local main to origin/main (`git merge --ff-only origin/main`)
   - If fast-forward fails (diverged history), stop and report — do not merge, rebase, or force-update

2. **Read context files** (in order):
   - `STATUS.md` — current capabilities, schema version, constraints
   - `PLANS.md` — active plans and backlog
   - `DECISIONS.md` — recent architecture decisions

3. **Summarize for the user**:
   - Current project state (what's implemented, what's in progress)
   - Active plans and their status
   - Recent decisions that may affect upcoming work
   - Known constraints or risks

4. **Confirm git state**:
   - Confirm on `main` branch
   - Confirm up-to-date with `origin/main` (no ahead/behind)
   - Show recent commits (last 5)

5. **Ask** what the user wants to work on, or confirm the active plan.
   - If the user wants to implement a plan, route through **session-transition** first (do not jump straight to session-implement)

## Rules
- Do NOT start coding or making changes
- Do NOT read MEMORY.md unless the user's task requires reference material
- Keep the summary concise — bullet points, not paragraphs
