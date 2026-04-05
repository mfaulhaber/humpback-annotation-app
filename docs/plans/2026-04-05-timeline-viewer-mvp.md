# Timeline Viewer MVP Implementation Plan

**Goal:** Replace the active annotation UI with a readonly timeline viewer MVP
that consumes same-origin exported artifacts locally and through
CloudFront-backed S3 in production.
**Spec:** `docs/specs/2026-04-05-timeline-viewer-mvp-design.md`

---

### Task 1: Replace the active app surface with timeline routes

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`
- Create: `frontend/src/pages/TimelineIndexPage.tsx`
- Create: `frontend/src/pages/TimelineViewerPage.tsx`
- Create: `frontend/src/components/timeline/TimelineLayout.tsx`

**Acceptance criteria:**
- [ ] `/` renders the new timeline landing page instead of the folder list
- [ ] `/:jobId` renders the new timeline viewer entry point
- [ ] Legacy annotation routes are removed from the active router
- [ ] Navigation and page copy describe the timeline viewer MVP rather than the
      annotation workflow

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- Manual smoke of `/` and `/:jobId` with local exported artifacts available

---

### Task 2: Add same-origin export loading and local `/data` serving

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `.env.local.example`
- Create: `frontend/src/api/timeline.ts`
- Create: `frontend/src/lib/timeline-contract.ts`
- Create: `frontend/src/lib/timeline-errors.ts`

**Acceptance criteria:**
- [ ] Local development can mount a `TIMELINE_EXPORT_ROOT` directory at
      `/data/*`
- [ ] The landing page loads `data/index.json` directly from same-origin static
      paths
- [ ] The viewer loads `data/{jobId}/manifest.json` directly from same-origin
      static paths
- [ ] Unsupported manifest versions and missing required artifacts produce
      clear error states

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- Manual smoke with `TIMELINE_EXPORT_ROOT=... pnpm --filter @humpback/frontend dev`

---

### Task 3: Implement the timeline viewer shell, viewport math, and controls

**Files:**
- Create: `frontend/src/components/timeline/TimelineViewport.tsx`
- Create: `frontend/src/components/timeline/TimelineControls.tsx`
- Create: `frontend/src/components/timeline/ConfidenceStrip.tsx`
- Create: `frontend/src/components/timeline/DetectionOverlay.tsx`
- Create: `frontend/src/components/timeline/VocalizationOverlay.tsx`
- Create: `frontend/src/hooks/useTimelinePlayback.ts`
- Create: `frontend/src/lib/timeline-math.ts`
- Create: `frontend/src/lib/tile-cache.ts`
- Modify: `frontend/src/pages/TimelineViewerPage.tsx`

**Acceptance criteria:**
- [ ] The viewer renders spectrogram tiles against the manifest-defined zoom
      levels and viewport spans
- [ ] A fixed center playhead, UTC time readout, and frequency axis are present
- [ ] Confidence, detection, and vocalization layers render from manifest data
- [ ] Transport controls, zoom controls, and keyboard shortcuts work for the
      readonly MVP
- [ ] Audio playback uses chunk-based preloading with seamless enough boundary
      handling for the MVP

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- Manual smoke covering zoom, pan, overlay toggles, and audio playback using a
  representative local export

---

### Task 4: Update docs and architecture records for the MVP pivot

**Files:**
- Modify: `README.md`
- Modify: `STATUS.md`
- Modify: `MEMORY.md`
- Modify: `DECISIONS.md`

**Acceptance criteria:**
- [ ] Repo docs describe the timeline viewer as the active MVP surface
- [ ] Local setup docs explain `TIMELINE_EXPORT_ROOT` and same-origin `/data`
      serving
- [ ] Status and memory docs explain that annotation code remains in-repo but
      is hidden from the active app
- [ ] `DECISIONS.md` records the static same-origin timeline-viewer pivot if
      the implementation finalizes that architectural direction

**Verification:**
- Review the updated docs for consistency with the implemented runtime behavior

---

### Verification

Run after all tasks:
1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test` if new targeted coverage is added for timeline utilities; if not,
   call out that the current repo tests do not cover the static timeline viewer
   path
4. Manual smoke of the landing page and viewer page against a real local export
   directory
