# Job Hints on Timeline Cards Implementation Plan

**Goal:** Extend the timeline landing-page index contract so individual jobs
can carry hint text, and render that hint content on the main-page timeline
cards without breaking existing export readers.
**Spec:** Conversation-approved design

---

### Task 1: Extend the timeline index contract for per-job hints

**Files:**
- Modify: `frontend/src/lib/timeline-contract.ts`
- Modify: `frontend/src/lib/timeline-contract.test.ts`
- Modify: `frontend/src/lib/timeline-test-fixtures.ts`

**Acceptance criteria:**
- [ ] Timeline index entries may include a `hints` string field
- [ ] Frontend contract validation accepts entries with valid `hints` text and
      rejects invalid non-string values
- [ ] Existing manifest validation behavior remains unchanged

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

---

### Task 2: Render hint text on timeline cards and document the contract

**Files:**
- Modify: `frontend/src/pages/TimelineIndexPage.tsx`
- Modify: `frontend/src/timeline.css`
- Modify: `README.md`

**Acceptance criteria:**
- [ ] Timeline cards show hint text when a job entry includes it
- [ ] Cards without hint text remain visually valid and readable
- [ ] Repo docs describe the `index.json` hint field truthfully

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- Manual smoke of the landing page only if automated coverage is insufficient

---

### Verification

Run after all tasks:
1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test`
4. Manual landing-page smoke only if needed for the new card content path
