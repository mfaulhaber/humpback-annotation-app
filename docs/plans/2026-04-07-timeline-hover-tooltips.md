# Timeline Hover Tooltips Implementation Plan

**Goal:** Keep timeline hover popups visible inside the viewport, add
vocalization hover detail, and align the popup copy/styling with the current
active timeline viewer behavior.
**Spec:** [Timeline Hover Tooltip Design](/Users/michael/development/humpback-annotation-app/docs/specs/2026-04-07-timeline-hover-tooltip-design.md)

---

### Task 1: Extend overlay geometry for shared detection and vocalization hover behavior

**Files:**
- Modify: `frontend/src/lib/timeline-overlay-geometry.ts`
- Modify: `frontend/src/lib/timeline-overlay-geometry.test.ts`

**Acceptance criteria:**
- [x] Detection hover continues to use geometry-based hit testing from the
      active canvas viewport
- [x] Vocalization windows expose geometry that can be hit-tested even when the
      label chips are visually compact or hidden at coarser zoom levels
- [x] Shared overlay helpers provide enough information for tooltip content to
      render styled vocalization rows with per-type confidence without changing
      the manifest contract

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

---

### Task 2: Render a pointer-anchored in-track hover card for detections and vocalizations

**Files:**
- Modify: `frontend/src/components/timeline/TimelineViewport.tsx`
- Modify: `frontend/src/timeline.css`
- Create: `frontend/src/components/timeline/TimelineViewport.test.ts`

**Acceptance criteria:**
- [x] Detection hover cards render near the hover position and stay inside the
      clipped timeline track
- [x] Detection hover content renders as a single line using average
      confidence only, in the form `Detection: <avg>%`
- [x] Vocalization hover cards appear in vocalization overlay mode and render
      one stacked row per hovered type, in the form `<Type>: <confidence>%`
- [x] Vocalization popup rows reuse the timeline's color-coded label styling,
      including dashed inference treatment
- [x] Hover state clears while dragging and when the pointer leaves the track
- [x] Tooltip styling remains readable for multi-type vocalization windows

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
