# UI Regression Testing Framework Design

**Date**: 2026-04-08
**Status**: Draft
**Audience**: Humpback Timeline Viewer contributors

## 1. Summary

Introduce a dedicated browser-resident UI regression layer for the active
timeline viewer. Keep the current fast Vitest unit coverage for timeline math,
geometry, and helper logic, but add a real-browser route test harness plus a
small curated visual baseline set for the regressions captured in
`docs/report/2026-04-08-ui-layout-regression-report.md`.

The recommended first implementation is:

1. keep the existing Node/Vitest unit suite as the fast base layer
2. add a Playwright page-level UI suite against the real frontend
3. run that suite against a small deterministic export fixture derived from
   real exported data and mounted at same-origin `/data/*`
4. add a small set of visual baselines for the viewer states that were most
   regression-prone during the 2026-04-08 session

The framework should also support an opt-in local smoke lane that points at a
real external export root through `TIMELINE_EXPORT_ROOT`, without making that
machine-specific dataset the default automated fixture.

This design intentionally focuses on the active timeline viewer only. The
dormant annotation API, DynamoDB stack, and legacy auth flows remain out of
scope.

## 2. Context

The 2026-04-08 UI regression report identified a repeated failure pattern in
the active viewer:

- layout regressions only visible in a real browser
- brittle resize behavior across desktop, tablet, and mobile widths
- drift between CSS layout, measured track size, canvas drawing, and axis
  labeling
- overlay rendering issues that escaped isolated helper tests

Current test posture:

- `frontend/vitest.config.ts` runs in a pure `node` environment
- active frontend coverage is concentrated in utility-style tests under
  `frontend/src/lib/`, `frontend/src/hooks/`, and a helper-only
  `TimelineViewport.test.ts`
- there is no browser DOM test lane
- there is no screenshot baseline lane
- there is no current CI workflow in `.github/`

That means the repository is currently strong at proving math and helper
correctness, but weak at proving:

- actual CSS layout and overflow behavior
- `ResizeObserver`-driven size updates
- playhead, axis, confidence strip, and track alignment in the browser
- canvas and overlay presentation after responsive layout changes

## 3. Goals

This effort should:

1. catch the specific layout and resize regressions from the 2026-04-08 report
   before manual smoke testing
2. exercise the viewer in a real browser with actual DOM, CSS, canvas, and
   `ResizeObserver` behavior
3. validate the real route-level viewer flow, including same-origin `/data/*`
   loading
4. add a small, high-signal visual regression layer for the canvas-heavy
   timeline states that are difficult to assert structurally
5. keep the existing Vitest unit suite as the fast feedback layer
6. use fixture data that still represents real exported viewer output rather
   than an overly synthetic toy contract
7. stay practical for local development today and future CI adoption later

## 4. Non-Goals

Out of scope for the first version:

- replacing the current Vitest unit suite
- testing the dormant annotation stack through a browser lane
- broad cross-browser parity across Chromium, Firefox, and WebKit
- adopting Storybook for the entire viewer application
- exhaustive audio playback correctness or media decoding coverage
- auto-updating screenshot baselines on every change

## 5. Approaches Considered

### Approach A: Vitest Browser Mode plus Playwright provider

Use Vitest Browser Mode for real-browser component and page-style tests while
keeping the repository on one main testing family.

Pros:

- fits naturally with the existing Vitest setup
- official browser-mode support exists for React
- built-in browser screenshots are available
- would keep more of the testing API consistent with the current suite

Cons:

- the main regressions were page-level route and layout failures, not isolated
  component failures
- the active viewer depends on real route behavior plus same-origin `/data/*`
  loading, so a component-first browser harness would still need extra fixture
  plumbing
- it is a weaker fit for the "run the real app and inspect the real page"
  debugging loop than a dedicated page runner

### Approach B: Playwright page-level UI suite against the real frontend

Add a dedicated Playwright suite that launches the real frontend, serves a
deterministic fixture export root through the existing `/data/*` path, and
asserts layout, resize behavior, and screenshots through route-level tests.

Pros:

- best match for the regressions in the report, which were all page-level
  browser failures
- naturally exercises the real router, CSS layout, `ResizeObserver`, canvas,
  and same-origin data loading path together
- strong support for viewport emulation, retries, traces, failure screenshots,
  and targeted visual snapshots
- straightforward future path to CI once the repo adds workflows

Cons:

- introduces a second primary test runner alongside Vitest
- requires browser installation and a slightly heavier test lane
- screenshot baselines need a deliberate review/update workflow

### Approach C: Storybook plus Chromatic visual testing

Adopt Storybook stories for the viewer shell and use Chromatic-backed visual
testing for screenshot review and PR checks.

Pros:

- polished visual diff workflow
- automatic visual testing across stories
- attractive if the repo later grows a broader reusable component library

Cons:

- adds a story authoring layer the repo does not currently have
- pushes the first solution toward a cloud service and account setup
- weaker fit for the current route-level viewer, which depends on responsive
  layout, canvas drawing, and same-origin timeline export data

## 6. Decision

Choose **Approach B**.

The problems described in the regression report are not mainly "component
looks wrong in isolation" problems. They are "the real viewer page breaks when
browser layout, measured size, and canvas rendering interact" problems.

That makes a route-level real-browser harness the most direct and truthful
first layer:

- it validates the actual `/:jobId` viewer page
- it keeps the real `/data/*` loading contract in play
- it can resize the viewport exactly the way the session bugs surfaced
- it gives us a clean path to targeted screenshot baselines for canvas-heavy
  viewer states

Vitest remains the right tool for the current unit suite. If the repository
later needs finer-grained browser component tests beyond the route harness, we
can still add Vitest Browser Mode later without discarding this design.

## 7. Proposed Framework

### 7.1 Testing Layers

The active frontend should use three layers:

1. **Unit layer**
   - keep the current Node/Vitest tests for timeline math, geometry, contract
     validation, playback helpers, and renderer helpers

2. **Browser DOM/layout layer**
   - use Playwright to mount the real frontend and navigate actual routes
   - assert bounding boxes, visibility, overflow, resize behavior, and
     alignment invariants

3. **Visual regression layer**
   - use Playwright screenshot assertions for a small curated matrix of viewer
     states
   - keep the screenshot set intentionally small and tied to known high-risk
     viewer scenarios

This preserves fast feedback while adding the browser coverage the current suite
is missing.

### 7.2 Harness Model

The browser suite should test the real frontend rather than a mocked page
facsimile.

Proposed harness:

- add a deterministic export fixture under
  `frontend/test-data/timeline-export/`
- point `TIMELINE_EXPORT_ROOT` at that fixture when launching the frontend for
  tests
- navigate the real app routes:
  - `/`
  - `/:jobId`

The fixture export root should contain:

- `index.json`
- at least one job directory with `manifest.json`
- a minimal but deterministic set of PNG tiles for the zoom levels covered by
  screenshot tests
- optional short silent audio only if playback scenarios are added later

This fixture should be derived from a real exported job rather than authored by
hand from scratch. The goal is to preserve real-world manifest shapes,
confidence density, overlay distributions, and tile rendering characteristics
while trimming the data down to a size that is safe to commit and practical to
run in automation.

This keeps the tests aligned with the real active contract instead of creating
an alternate mocking-only path.

### 7.3 Data Strategy

The UI framework should use two complementary data modes.

#### Mode A: committed deterministic fixture for automation

This is the default for `test:ui` and `test:ui:visual`.

Properties:

- checked into the repo
- small enough for fast local runs and future CI
- stable enough for screenshot baselines
- derived from real export output rather than invented from scratch

Recommended contents:

- one representative job
- `index.json`
- one real-derived `manifest.json`
- enough tile assets to exercise the zooms covered by the initial layout and
  visual suite
- no audio by default unless a specific playback test requires it

Given the current real export shape at
`/Volumes/External_2TB/data/exports`, the fixture should be a curated subset,
not a copy of the full source export. The current source job is about `3.7G`
with `11,094` tile files and `288` audio chunks, which is far beyond what we
should commit into the repo.

#### Mode B: real-data local smoke lane

This is an opt-in developer workflow, not the default automated fixture lane.

Properties:

- uses a real external export root provided by the developer
- validates the viewer against full real-world data volume and density
- is appropriate for manual smoke tests or targeted local browser runs
- is not required for every automated test run

Example:

- `TIMELINE_EXPORT_ROOT=/Volumes/External_2TB/data/exports pnpm test:ui:smoke`

This mode is valuable because some canvas and responsiveness issues only become
obvious on dense, production-like exports. But it should remain optional,
because it depends on external storage, local machine setup, and a dataset too
large for deterministic repo-managed automation.

### 7.4 Server Strategy

The browser suite should prefer serving a built frontend through `vite preview`
instead of relying on the dev server.

Why:

- fewer moving parts during screenshots
- no HMR noise
- closer to the shipped viewer path
- better reproducibility between local runs and future CI runs

Implementation expectation:

- add a frontend `preview` script
- let Playwright launch that server with `TIMELINE_EXPORT_ROOT` pointed at the
  test export root
- use Playwright `baseURL` so tests can navigate by route path

### 7.5 Stable Test Hooks

The viewer needs a small number of stable browser-facing hooks so layout tests
do not have to depend on brittle CSS selectors.

Add `data-testid` hooks to structural elements that are important but not
semantically rich enough for role-only selection:

- `timeline-shell`
- `timeline-viewer`
- `timeline-viewer-header`
- `timeline-controls`
- `timeline-stage`
- `timeline-track`
- `timeline-track-canvas`
- `timeline-confidence-strip`
- `timeline-axis`
- `timeline-playhead`
- `timeline-index-grid`

Interactive controls should still be selected primarily by accessible role and
name where possible, for example:

- play/pause button by `aria-label`
- overlay mode buttons by visible label
- zoom chips by visible label

The rule should be:

- use accessibility selectors for user-facing controls
- use `data-testid` for structural layout and canvas-backed regions

### 7.6 Shared Test Helpers

The UI lane should ship with a few shared helpers instead of repeating browser
plumbing in every spec:

1. `openViewer(page, options)`
   - navigate to a known fixture job
   - optionally set overlay mode and zoom

2. `waitForViewerStable(page)`
   - wait for loading state to clear
   - wait for fonts to settle
   - wait until the track and canvas have non-zero client size
   - wait through the next animation frames after resize-sensitive actions

3. `readViewerGeometry(page)`
   - return bounding boxes for shell, header, controls, stage, track, canvas,
     confidence strip, axis, and playhead

4. `resizeViewer(page, viewport)`
   - set viewport
   - wait for post-resize stability before assertions

5. `assertNoHorizontalOverflow(page)`
   - verify the viewer does not create unexpected page-level horizontal scroll

6. `resolveTestExportRoot()`
   - use the committed fixture by default
   - allow an explicit environment override for local real-data smoke runs

### 7.7 First-Wave Browser Assertions

The first implementation should cover the exact risks from the report.

#### Layout and visibility assertions

At target viewports, assert that:

- the viewer header remains visible
- controls remain reachable without unexpected clipping
- the timeline stage remains visible
- the page does not introduce horizontal overflow
- the track width remains greater than zero after resize

#### Resize matrix

Run a deterministic resize sequence:

1. desktop wide
2. desktop narrow
3. tablet portrait
4. mobile portrait
5. desktop wide again

Assert after each step that:

- the stage still renders
- the track, confidence strip, and axis remain present
- the measured track width changes in the expected direction
- the page does not fall into a blank-gap or hidden-stage state

#### Alignment invariants

Add structural assertions for:

- playhead marker visually centered in the track within a small pixel tolerance
- confidence strip width matching the track width within a small tolerance
- axis width matching the track content width within a small tolerance
- canvas right edge remaining inside the visible track bounds after resize

These assertions will not fully prove canvas correctness, but they will catch a
meaningful part of the "layout and measured-size drift" failure class.

### 7.8 Visual Regression Scope

Some of the regressions in the report are best caught visually, not with
geometry-only assertions. The first baseline set should stay deliberately
small.

Recommended initial golden set:

1. viewer shell in detections mode at desktop width
2. viewer shell after desktop-to-mobile resize
3. timeline stage in vocalizations mode at compact mobile width
4. timeline stage in vocalizations mode after a resize back to a narrower
   desktop layout

Guidelines:

- prefer element-level screenshots of the viewer shell or timeline stage, not
  whole-page screenshots
- keep playback paused for deterministic captures
- disable or neutralize animation and transition noise during screenshots
- keep screenshot fixtures tied to the same deterministic export root

This is enough to catch:

- oversized header/controls regressions
- stage clipping and blank-space regressions
- left/right overlay edge mistakes
- chip-scale and label-fit regressions that are hard to assert numerically

### 7.9 Coverage Mapping to the 2026-04-08 Report

| Reported regression | Primary coverage |
| --- | --- |
| Vocalization bars pinned to the left edge | visual stage snapshots at compact zoom levels |
| Header and controls too tall on mobile | mobile layout assertions plus viewer-shell screenshots |
| Resize redraw worse on shrink than expand | desktop → mobile → desktop resize sequence |
| Flex layout produced blank space and hidden timeline | visibility plus overflow assertions after resize |
| Time-axis labels drifted from the centered playhead | structural alignment checks plus post-resize screenshots |
| Vocalization chip boxes no longer matched resized text | vocalization-mode screenshots on compact layouts |

### 7.10 Repository Shape

One reasonable implementation layout:

- `frontend/playwright.config.ts`
- `frontend/tests/ui/viewer-layout.spec.ts`
- `frontend/tests/ui/viewer-resize.spec.ts`
- `frontend/tests/ui/viewer-visual.spec.ts`
- `frontend/tests/ui/viewer-smoke.spec.ts`
- `frontend/tests/ui/helpers/viewer.ts`
- `frontend/tests/ui/helpers/assertions.ts`
- `frontend/test-data/timeline-export/`

The exact filenames can change, but the important part is keeping browser tests
separate from the current unit-style `frontend/src/**/*.test.ts` suite.

### 7.11 Scripts

Recommended future scripts:

At the frontend package level:

- `test:ui` for the Playwright DOM/layout suite
- `test:ui:visual` for the curated screenshot suite
- `test:ui:smoke` for an opt-in run against a developer-provided real export
  root
- `test:ui:update` for intentional baseline refreshes
- `preview` for serving the built frontend

At the repo root:

- `pnpm test` should continue to mean the current fast frontend Vitest suite
- `pnpm test:ui` should run the browser layout suite
- `pnpm test:ui:visual` should run the screenshot suite
- `pnpm test:ui:smoke` should run the same browser harness against an explicit
  external export root when a developer wants higher-fidelity local coverage

This keeps the heavier browser lane explicit instead of silently making the
existing `pnpm test` workflow much slower overnight.

### 7.12 Debugging and Failure Artifacts

The UI lane should enable browser-debugging artifacts by default for failures:

- trace on first retry
- screenshot on failure
- optional video on retry only if failure debugging proves it valuable

This is important because many of the report’s failures required visual
inspection to understand quickly.

### 7.13 CI Adoption Path

The repo does not currently have CI workflows, so the first implementation
should work locally without assuming GitHub Actions already exists.

When CI is added later, the recommended first CI posture is:

1. run `pnpm typecheck`
2. run `pnpm build`
3. run `pnpm test`
4. run `pnpm test:ui`
5. run `pnpm test:ui:visual` on the same pinned Chromium environment used for
   the committed baselines

At the time of this design, the committed screenshot baselines target macOS
Chromium. If a future CI lane wants to run on Linux instead, generate and
commit a deliberate Linux baseline set first.

Screenshot baselines should be updated deliberately, not automatically on every
PR run.

The CI lane should use only the committed deterministic fixture. Real external
export roots remain a local-only smoke workflow.

## 8. Risks and Mitigations

### Risk: Screenshot flake across machines

Mitigation:

- pin visual tests to Chromium
- keep visual CI to one OS
- use targeted element screenshots
- keep fonts and viewport sizes deterministic

### Risk: Browser lane becomes too expensive to run on every change

Mitigation:

- keep `pnpm test` as the existing fast unit lane
- make browser layout and screenshot lanes explicit scripts
- keep the initial screenshot matrix small

### Risk: Canvas-heavy bugs remain hard to assert structurally

Mitigation:

- use geometry assertions where they are reliable
- rely on curated screenshots for the canvas-specific failure modes
- keep fixture data stable so visual diffs stay high-signal

### Risk: Fixture data drifts away from real viewer expectations

Mitigation:

- keep fixture export data contract-valid
- derive the committed fixture from a real export and refresh it deliberately
  when the export contract meaningfully changes
- include at least one representative vocalization-heavy job fixture
- update fixture docs when manifest contract changes

## 9. Rollout Recommendation

Implement in four passes:

1. **Infrastructure**
   - add Playwright config, scripts, preview server support, committed
     real-derived fixture export root, and stable `data-testid` hooks

2. **Layout and resize coverage**
   - add the viewer layout, overflow, resize, and alignment assertions

3. **Visual baselines**
   - add the curated screenshot matrix and document the intentional baseline
     update workflow

4. **Local real-data smoke coverage**
   - add an opt-in script and docs for running the same harness against an
     external `TIMELINE_EXPORT_ROOT`

This keeps the first merge focused and reduces the risk of introducing a large
unproven test surface all at once.

## 10. Verification Expectations For The Implementation Phase

When this design is implemented, the expected verification set should be:

1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test`
4. `pnpm test:ui`
5. `pnpm test:ui:visual` when the committed baseline environment is available,
   or a precise note about what was not run

## 11. External References

- Playwright `webServer` and `baseURL` configuration:
  https://playwright.dev/docs/test-webserver
- Playwright run-time configuration, viewport control, traces, and failure
  screenshots:
  https://playwright.dev/docs/test-use-options
- Playwright trace viewer:
  https://playwright.dev/docs/trace-viewer
- Vitest Browser Mode and React browser rendering:
  https://vitest.dev/guide/browser/
  and https://vitest.dev/guide/browser/component-testing
- Vitest visual regression testing:
  https://vitest.dev/guide/browser/visual-regression-testing
- Storybook visual testing and Chromatic:
  https://storybook.js.org/docs/writing-tests/visual-testing
