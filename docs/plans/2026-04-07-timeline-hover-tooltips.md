# Timeline Hover Tooltips Implementation Plan

**Goal:** Keep timeline hover popups visible inside the viewport, add
vocalization hover detail, and unify detection/vocalization confidence copy in
the active timeline viewer.
**Spec:** [Timeline Hover Tooltip Design](/Users/michael/development/humpback-annotation-app/docs/specs/2026-04-07-timeline-hover-tooltip-design.md)

---

### Task 1: Extend overlay geometry for shared detection and vocalization hover behavior

**Files:**
- Modify: `frontend/src/lib/timeline-overlay-geometry.ts`
- Modify: `frontend/src/lib/timeline-overlay-geometry.test.ts`

**Acceptance criteria:**
- [ ] Detection hover continues to use geometry-based hit testing from the
      active canvas viewport
- [ ] Vocalization windows expose geometry that can be hit-tested even when the
      label chips are visually compact or hidden at coarser zoom levels
- [ ] Shared overlay helpers provide enough information for tooltip content to
      show all hovered vocalization types and average confidence without
      changing the manifest contract

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

---

### Task 2: Render a pointer-anchored in-track hover card for detections and vocalizations

**Files:**
- Modify: `frontend/src/components/timeline/TimelineViewport.tsx`
- Modify: `frontend/src/timeline.css`
- Create: `frontend/src/components/timeline/TimelineViewport.test.tsx`

**Acceptance criteria:**
- [ ] Detection hover cards render near the hover position and stay inside the
      clipped timeline track
- [ ] Detection hover content uses the requested confidence copy pattern:
      `Confidence: <avg>% avg, <peak>% peak`
- [ ] Vocalization hover cards appear in vocalization overlay mode and show all
      vocal types in the hovered window plus `Confidence: <avg>% avg`
- [ ] Hover state clears while dragging and when the pointer leaves the track
- [ ] Tooltip styling remains readable for multi-type vocalization windows

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- Manual smoke of detection and vocalization hover behavior at `15m`, `5m`,
  and `1m` if automated coverage does not fully exercise the UI path

---

### Verification

Run after all tasks:
1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test`
4. Manual hover smoke only for behavior that is not yet credibly covered by
   the frontend suite
