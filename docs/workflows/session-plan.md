# session-plan

Create or refine the implementation plan, prepare the working branch for
non-trivial work, and keep repo-local planning artifacts current.

## Preconditions

- The task is understood well enough to plan
- You are either on `main` starting fresh or on the intended working branch for
  a resumed effort

## Steps

1. **Read the approved task brief or design**
   - Use conversation context or a written spec in `docs/specs/`
   - Review `CLAUDE.md` and `DECISIONS.md` when the task touches product rules,
     DynamoDB, API shape, or workflow conventions

2. **Derive a short feature name**
   - Example: `real-whale-data-ingestion`

3. **Create or confirm the working branch**
   - For non-trivial work, create `feature/<feature-name>` from `main`
   - If resuming, confirm the existing branch still matches the requested scope
   - For tiny docs-only work, follow the user's explicit branching preference

4. **Break the work into discrete tasks**
   - Each task should include:
     - title
     - exact file paths to create or modify
     - acceptance criteria
     - verification requirements, including `pnpm test`, `pnpm test:legacy`,
       or manual smoke when relevant
   - Note required doc or memory-file updates when the change affects
     architecture, workflows, data models, or implemented status

5. **Write the plan artifacts**
   - Save the implementation plan to `docs/plans/YYYY-MM-DD-<feature>.md`
   - Save a design spec to `docs/specs/YYYY-MM-DD-<topic>-design.md` when the
     task needs one

6. **Keep planning artifacts together**
   - Prefer one repo-local plan file in `docs/plans/` per scoped effort
   - Refresh the plan or spec in place when resuming the same effort

7. **Commit planning artifacts together**
   - Commit the plan and spec together when they are newly created

## Plan Format

```markdown
# <Feature Name> Implementation Plan

**Goal:** One sentence describing what this change accomplishes
**Spec:** Link to the design spec, or "Conversation-approved design"

---

### Task N: <Task Title>

**Files:**
- Create: `exact/path/to/file.ext`
- Modify: `exact/path/to/existing.ext`

**Acceptance criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test` when the touched active frontend or isolated package logic is
  covered
- `pnpm test:legacy` when the touched dormant API or data flow is covered and
  the local stack is available
- Manual smoke only for changed paths without credible automated coverage

---

### Verification

Run after all tasks:
1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test` when the touched active frontend behavior is covered
4. `pnpm test:legacy` when the touched dormant API or data behavior is covered
   and required local services are available
5. Manual smoke-test only the changed behavior that is not yet credibly covered
```

## Does NOT

- Implement the feature
- Push to remote
- Require code blocks inside task descriptions

## Output

Plan file committed on the working branch when planning artifacts were created.

## Next Step

`session-implement`
