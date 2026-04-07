# Canvas Viewport Implementation Plan

**Goal:** Replace the DOM-based timeline viewport with a canvas-backed renderer
and live playback clock integration so the viewer scrolls smoothly during
playback, especially at `5m` and `1m` zoom.
**Spec:** `docs/specs/2026-04-05-canvas-viewport-design.md`

---

### Task 1: Add a live playback clock API that is not limited by `timeupdate`

**Files:**
- Modify: `frontend/src/hooks/useTimelinePlayback.ts`
- Create: `frontend/src/lib/timeline-playback-clock.ts`
- Create: `frontend/src/lib/timeline-playback-clock.test.ts`
- Modify: `frontend/src/hooks/useTimelinePlayback.test.ts`

**Acceptance criteria:**
- [ ] Playback code can report an absolute live timestamp derived from the
      active audio element and chunk metadata without waiting for React state
- [ ] Existing seek, pause, and chunk handoff behavior stays correct
- [ ] The live playback clock can be consumed by the viewport without forcing
      the whole page to re-render at animation-frame cadence

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

---

### Task 2: Replace the viewport's DOM tile and overlay renderer with canvas drawing

**Files:**
- Modify: `frontend/src/components/timeline/TimelineViewport.tsx`
- Create: `frontend/src/lib/timeline-canvas-renderer.ts`
- Create: `frontend/src/lib/timeline-overlay-geometry.ts`
- Create: `frontend/src/lib/timeline-canvas-renderer.test.ts`
- Modify: `frontend/src/timeline.css`

**Acceptance criteria:**
- [ ] Spectrogram tiles are drawn with canvas using the existing same-origin
      tile URLs and cache
- [ ] Detection and vocalization overlays remain aligned to the viewport time
      scale
- [ ] Playback redraws remain visually smooth at `5m` and `1m` zoom
- [ ] Drag preview plus click/drag commit still target the correct timestamps

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- Manual smoke of playback at `5m` and `1m`

---

### Task 3: Integrate the canvas viewport into viewer state and preserve UX behavior

**Files:**
- Modify: `frontend/src/pages/TimelineViewerPage.tsx`
- Modify: `frontend/src/components/timeline/TimelineControls.tsx`
- Modify: `frontend/src/lib/timeline-viewer-state.ts`
- Modify: `frontend/src/lib/timeline-viewer-state.test.ts`

**Acceptance criteria:**
- [ ] Playing audio keeps the viewport centered on a smoothly advancing playback
      clock
- [ ] The UTC time readout stays in sync with playback and manual seeks
- [ ] Overlay toggles, zoom changes, keyboard shortcuts, and pause/resume
      semantics continue to work

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- Manual smoke of play/pause, click seek, drag seek, and zoom changes

---

### Task 4: Document the rendering shift and any finalized architecture notes

**Files:**
- Modify: `README.md`
- Modify: supporting repo docs as needed
- Modify: `DECISIONS.md`

**Acceptance criteria:**
- [ ] Repo docs describe the active viewer viewport as canvas-backed if the
      implementation finalizes that architecture
- [ ] Supporting repo docs call out the live playback clock behavior and any
      remaining limitations
- [ ] `DECISIONS.md` records the renderer architecture shift if it becomes an
      accepted direction

**Verification:**
- Review the updated docs for consistency with the implemented runtime behavior

---

### Verification

Run after all tasks:
1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test`
4. Manual smoke of playback at `15m`, `5m`, and `1m`, covering play/pause,
   click seek, drag seek, overlay toggles, and chunk-boundary transitions
5. `pnpm test:legacy` is not required unless dormant annotation code changes
