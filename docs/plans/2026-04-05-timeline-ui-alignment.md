# Timeline UI Alignment Implementation Plan

**Goal:** Align the active timeline viewer's detection and vocalization
overlays with the supplied screenshot references by making the lower viewport
area feel more integrated, compact, and visually intentional.
**Spec:** `docs/specs/2026-04-05-timeline-ui-alignment-design.md`

---

### Task 1: Rework detection rendering into a slim integrated lower band

**Files:**
- Modify: `frontend/src/components/timeline/TimelineViewport.tsx`
- Modify: `frontend/src/lib/timeline-canvas-renderer.ts`
- Modify: `frontend/src/lib/timeline-overlay-geometry.ts`
- Modify: `frontend/src/timeline.css`
- Modify: `frontend/src/lib/timeline-canvas-renderer.test.ts`

**Acceptance criteria:**
- [ ] Detections render as a thinner, bottom-aligned segmented band that better
      matches the screenshot direction
- [ ] Detection geometry still aligns to timeline time ranges and current zoom
- [ ] Hover behavior remains usable after the styling change, including dense
      segments near the playhead

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- Manual smoke of detection hover/readability at multiple zoom levels

---

### Task 2: Rework vocalization overlays to fit the same lower-edge visual system

**Files:**
- Modify: `frontend/src/components/timeline/TimelineViewport.tsx`
- Modify: `frontend/src/lib/timeline-canvas-renderer.ts`
- Modify: `frontend/src/lib/timeline-overlay-geometry.ts`
- Modify: `frontend/src/lib/timeline-math.ts`
- Modify: `frontend/src/timeline.css`
- Create: `frontend/src/lib/timeline-overlay-geometry.test.ts`

**Acceptance criteria:**
- [ ] Vocalization chips no longer feel like top-of-viewport floating elements
- [ ] Vocalization layout uses predictable stacked lanes near the lower part of
      the viewport
- [ ] Chip sizing, spacing, and colors feel visually compatible with the new
      detection treatment while preserving label legibility

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- Manual smoke of dense vocalization windows at `15m`, `5m`, and `1m`

---

### Task 3: Tighten the stage chrome, axis treatment, and viewer composition

**Files:**
- Modify: `frontend/src/pages/TimelineViewerPage.tsx`
- Modify: `frontend/src/components/timeline/TimelineControls.tsx`
- Modify: `frontend/src/components/timeline/TimelineLayout.tsx`
- Modify: `frontend/src/components/timeline/ConfidenceStrip.tsx`
- Modify: `frontend/src/timeline.css`

**Acceptance criteria:**
- [ ] The viewport remains the dominant visual surface of the viewer page
- [ ] The playhead and time axis feel more integrated with the viewport and the
      lower overlay system
- [ ] Shell and control styling are quieter without regressing responsiveness
      or keyboard/pointer usability

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- Manual smoke of play/pause, seek, zoom, and responsive layout

---

### Task 4: Refresh tests and status docs for the refined viewer behavior

**Files:**
- Modify: `STATUS.md`
- Modify: `frontend/src/lib/timeline-canvas-renderer.test.ts`
- Modify: `frontend/src/lib/timeline-math.test.ts`

**Acceptance criteria:**
- [ ] Automated coverage reflects any new overlay geometry or renderer
      expectations introduced by the alignment pass
- [ ] `STATUS.md` still describes the active viewer truthfully if the overlay
      behavior becomes more specific or visibly different

**Verification:**
- Review the updated tests and status doc for consistency with the final UI

---

### Verification

Run after all tasks:
1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test`
4. Manual smoke of the timeline viewer at `15m`, `5m`, and `1m`, covering:
   detection styling, vocalization styling, playhead readability, hover states,
   click seek, drag seek, and play/pause
5. `pnpm test:legacy` is not required unless dormant annotation code changes
