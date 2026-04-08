# UI Regression Testing Framework Implementation Plan

**Goal:** Add a reproducible browser-based UI regression framework for the
active timeline viewer that catches real layout, resize, and visual regressions
while supporting both a committed real-derived fixture and an opt-in local
smoke lane against a full external export root.
**Spec:** [UI Regression Testing Framework Design](/Users/michael/development/humpback-annotation-app/docs/specs/2026-04-08-ui-testing-framework-design.md)

---

### Task 1: Add Playwright browser-test infrastructure and export-root resolution

**Files:**
- Modify: `package.json`
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Modify: `pnpm-lock.yaml`
- Create: `frontend/playwright.config.ts`
- Create: `frontend/tests/ui/helpers/viewer.ts`
- Create: `frontend/tests/ui/helpers/assertions.ts`
- Create: `frontend/tests/ui/helpers/export-root.ts`

**Acceptance criteria:**
- [ ] The frontend package exposes Playwright-backed browser scripts for
      layout, visual, and smoke runs without changing the meaning of the
      existing fast `pnpm test` unit lane
- [ ] The browser harness launches the built frontend through a preview-style
      server and serves same-origin `/data/*` from a configurable export root
- [ ] The browser harness defaults to the committed UI fixture export root and
      supports an explicit `TIMELINE_EXPORT_ROOT` override for local smoke runs
- [ ] Failure artifacts are configured so browser regressions are debuggable
      through traces and screenshots

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:ui` after the layout suite exists

---

### Task 2: Add a committed real-derived fixture export and stable layout hooks

**Files:**
- Create: `frontend/test-data/timeline-export/README.md`
- Create: `frontend/test-data/timeline-export/index.json`
- Create: `frontend/test-data/timeline-export/8224c4a6-bc36-43db-ad59-e8933ef09115/manifest.json`
- Create: `frontend/test-data/timeline-export/8224c4a6-bc36-43db-ad59-e8933ef09115/tiles/`
- Modify: `frontend/src/components/timeline/ConfidenceStrip.tsx`
- Modify: `frontend/src/components/timeline/TimelineControls.tsx`
- Modify: `frontend/src/components/timeline/TimelineLayout.tsx`
- Modify: `frontend/src/components/timeline/TimelineViewport.tsx`
- Modify: `frontend/src/pages/TimelineIndexPage.tsx`
- Modify: `frontend/src/pages/TimelineViewerPage.tsx`

**Acceptance criteria:**
- [ ] The committed fixture is explicitly documented as a curated subset derived
      from real exported data rather than a hand-invented toy manifest
- [ ] The committed fixture is small enough for repo use while still covering a
      representative vocalization and detection-heavy viewer case
- [ ] The active viewer exposes stable browser-facing `data-testid` hooks for
      structural regions such as the shell, header, controls, stage, track,
      canvas, confidence strip, axis, and playhead
- [ ] The fixture and hooks work with both the committed test export and a real
      external export root override

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- Manual fixture smoke in the browser if the initial fixture wiring lacks full
  automated coverage

---

### Task 3: Add layout, resize, visual, and smoke browser coverage

**Files:**
- Create: `frontend/tests/ui/viewer-layout.spec.ts`
- Create: `frontend/tests/ui/viewer-resize.spec.ts`
- Create: `frontend/tests/ui/viewer-visual.spec.ts`
- Create: `frontend/tests/ui/viewer-smoke.spec.ts`
- Create: `frontend/tests/ui/__snapshots__/`

**Acceptance criteria:**
- [ ] The layout suite asserts viewer visibility, no unexpected horizontal
      overflow, reachable controls, and non-zero track sizing
- [ ] The resize suite covers the desktop-wide → desktop-narrow → tablet →
      mobile → desktop-wide sequence and asserts that the timeline stage,
      confidence strip, and axis remain present and aligned
- [ ] The visual suite captures a small curated golden set for detections,
      vocalizations, and compact responsive layouts using the committed fixture
- [ ] The smoke suite can run the same browser harness against an explicit
      external export root and fails clearly when no smoke export root is
      provided

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:ui`
- `pnpm test:ui:visual`
- `TIMELINE_EXPORT_ROOT=/Volumes/External_2TB/data/exports pnpm test:ui:smoke`
  when the external export root is available; otherwise note exactly what was
  not run

---

### Task 4: Update repo docs and workflow mirrors for the new UI test lane

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/workflows/session-implement.md`
- Modify: `docs/workflows/session-review.md`
- Modify: `.claude/commands/session-implement.md`
- Modify: `.claude/commands/session-review.md`

**Acceptance criteria:**
- [ ] Repo docs explain the new browser-layout and visual regression scripts,
      the committed fixture strategy, and the opt-in real-data smoke workflow
- [ ] Verification guidance stays truthful about when `pnpm test:ui`,
      `pnpm test:ui:visual`, and `pnpm test:ui:smoke` are expected versus
      optional
- [ ] Workflow docs and `.claude/commands/` mirrors remain aligned after the
      verification guidance changes

**Verification:**
- Review the updated docs for consistency with the implemented scripts and
  fixture strategy

---

### Verification

Run after all tasks:
1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test`
4. `pnpm test:ui`
5. `pnpm test:ui:visual` on the pinned visual environment, or state exactly
   what was not run
6. `TIMELINE_EXPORT_ROOT=/Volumes/External_2TB/data/exports pnpm test:ui:smoke`
   when the external export root is available; otherwise state exactly what was
   not run
