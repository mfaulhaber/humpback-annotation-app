# Index Viewer Defaults Implementation Plan

**Goal:** Extend `data/index.json` so each timeline job can optionally set the
viewer's initial playhead position, zoom level, and overlay mode without
changing the manifest contract or breaking direct viewer route loads.
**Spec:** [Timeline Index Viewer Defaults Design](/Users/michael/development/humpback-annotation-app/docs/specs/2026-04-10-index-viewer-defaults-design.md)

---

### Task 1: Extend the timeline index contract and validation for viewer defaults

**Files:**
- Modify: `frontend/src/lib/timeline-contract.ts`
- Modify: `frontend/src/lib/timeline-contract.test.ts`
- Modify: `frontend/src/lib/timeline-test-fixtures.ts`

**Acceptance criteria:**
- [ ] `TimelineEntry` accepts optional `starting_pos`, `zoom_level`, and
      `view_mode` fields
- [ ] Index validation continues to accept existing entries that omit the new
      fields
- [ ] Index validation rejects invalid enum values and non-integer or
      non-numeric `starting_pos` values
- [ ] Manifest validation and manifest-version behavior remain unchanged

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

---

### Task 2: Resolve initial viewer state from the matching index entry

**Files:**
- Modify: `frontend/src/api/timeline.ts`
- Modify: `frontend/src/pages/TimelineViewerPage.tsx`

**Acceptance criteria:**
- [ ] The viewer route still requires `data/{jobId}/manifest.json` and remains
      directly loadable at `/:jobId`
- [ ] The viewer also reads `data/index.json` as optional enhancement data and
      finds the matching `job_id` entry when available
- [ ] `starting_pos` sets the initial centered playhead timestamp, clamped to
      the manifest range
- [ ] `zoom_level` sets the initial zoom target and degrades to the nearest
      supported manifest zoom when the requested level is unavailable
- [ ] `view_mode` sets the initial overlay mode, defaulting to `detections`
      when absent
- [ ] If `index.json` cannot be read or the job entry is missing, the viewer
      falls back to the current manifest-derived defaults rather than failing

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:ui`

---

### Task 3: Document the new export metadata and cover route-level defaults

**Files:**
- Modify: `README.md`
- Modify: `frontend/test-data/timeline-export/index.json`
- Create: `frontend/tests/ui/viewer-defaults.spec.ts`
- Modify: `frontend/tests/ui/helpers/viewer.ts`

**Acceptance criteria:**
- [ ] README documents the three new optional `index.json` fields and their
      meanings truthfully
- [ ] The committed UI fixture includes representative default-view metadata so
      browser coverage exercises the export-driven path
- [ ] Browser coverage proves the viewer can open with index-driven initial
      zoom, overlay mode, and centered timecode
- [ ] Existing layout-oriented browser coverage remains compatible with the new
      fixture defaults

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:ui`

---

### Verification

Run after all tasks:
1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test`
4. `pnpm test:ui`
5. Manual viewer smoke only if the route-level default-state behavior is not
   credibly covered by the automated suite
