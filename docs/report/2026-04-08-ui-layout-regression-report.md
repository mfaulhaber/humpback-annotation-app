# UI Layout Regression Report

**Date**: 2026-04-08
**Branch Context**: `feature/vocalization-left-scroll-fix`
**Scope**: Timeline viewer layout, resize behavior, canvas alignment, and vocalization overlay rendering

## Summary

This session surfaced a recurring weakness in the active timeline viewer:
multiple user-facing regressions were introduced while trying to improve
responsiveness and resize behavior.

The main lesson is that the current frontend test suite is strong on isolated
utility logic, but weak on browser-resident DOM behavior. We need a stronger
DOM-focused test platform for layout, resize, and canvas/overlay synchronization
to reduce regressions in the active UI.

## What Regressed During This Session

Several issues were found and fixed iteratively:

1. Vocalization indicator bars pinned to the left edge during playback while
   detections scrolled correctly.
2. Header and controls consumed too much vertical space, especially on mobile.
3. Timeline redraw behavior during resize became inconsistent, with shrink
   handling noticeably worse than expand handling.
4. Viewer flex layout became brittle:
   - page sections stopped resizing with the window
   - blank space appeared where controls should have flowed naturally
   - timeline visibility regressed after layout changes
5. Time-axis labels drifted out of sync with the playhead after resize.
6. Vocalization chip labels kept desktop-sized bounding boxes after resize and
   no longer matched their rendered text scale.

None of these failures were in the dormant API or data model. They were all in
the active frontend and mostly involved browser layout, measured element size,
canvas drawing, and CSS interaction.

## Why These Regressions Were Hard To Catch

The current frontend coverage is mostly unit-style coverage over:

- timeline math
- overlay geometry
- canvas draw call behavior
- viewer state helpers

That coverage is still useful, but it does not validate:

- actual DOM element sizes after CSS layout
- how flex/grid containers react to viewport changes
- whether measured track size matches the visible rendered box
- whether the canvas, confidence strip, axis, and playhead remain aligned after
  resize
- whether text chips still fit their boxes in the real browser rendering path

In practice, several regressions only appeared when:

- resizing the browser window
- switching between mobile-like and desktop-like widths
- observing canvas and DOM overlays together
- comparing transport clock, playhead, time axis, and timeline imagery at the
  same time

Those are exactly the cases the current test suite does not exercise.

## Root Cause Pattern

The repeated failures came from one architectural seam:

- CSS layout decides the visible box
- React state stores a measured size
- canvas drawing uses that measured size
- the axis and overlays also depend on the same range/size assumptions

When any one of those layers lagged behind the others, the UI looked wrong even
though isolated helper tests still passed.

Examples from this session:

- A stale measured width caused time-axis labels to disagree with the centered
  playhead.
- Fixed chip metrics looked acceptable in a desktop-sized test fixture but were
  clearly wrong on a compact resized viewport.
- Viewer-level `height: 100%` and grid/flex interactions produced valid CSS but
  poor real browser behavior.

## What A Stronger UI Test Platform Should Cover

We should add a browser-resident DOM test layer for the active timeline viewer.

Minimum capabilities:

1. Real layout measurement
   - Assert rendered widths and heights of the viewer shell, header, stage,
     track, controls, confidence strip, and axis.
   - Validate no unexpected horizontal clipping or unreachable controls at
     target viewport sizes.

2. Resize scenarios
   - Start at desktop width, shrink to tablet/mobile widths, and expand again.
   - Assert that the timeline remains visible and that controls remain in view.
   - Assert that resize does not cause long redraw stalls.

3. Cross-layer synchronization
   - Validate that the playhead stays centered.
   - Validate that the time axis stays aligned with the current viewport range.
   - Validate that the confidence strip, tiles, and overlays share the same
     visible horizontal timeline mapping.

4. Visual regression coverage
   - Capture stable screenshots for a small matrix of viewport sizes and zoom
     levels.
   - Compare at least:
     - viewer shell layout
     - detections mode
     - vocalizations mode
     - compact mobile-like layout

5. Canvas plus overlay validation
   - Assert that vocalization labels fit their bounding boxes after resize.
   - Assert that indicator bars scroll offscreen correctly on both left and
     right edges.
   - Assert that the canvas is not clipped on the right after resize.

## Recommended Testing Shape

Rather than relying only on helper-unit tests, the repo should have three
frontend testing layers:

1. Keep the current fast unit coverage
   - timeline math
   - geometry helpers
   - state helpers
   - canvas rendering helpers

2. Add browser DOM/component coverage
   - mount the actual viewer page or viewer shell in a browser runtime
   - drive viewport resizing
   - read computed layout and element bounding boxes

3. Add visual regression checks for a small golden set
   - a few curated screenshots are likely to catch layout breakage faster than
     complex logic assertions

This layered approach should let us keep fast developer feedback while adding
high-signal regression coverage where the current suite is weakest.

## Suggested Immediate Follow-Up Work

1. Introduce a browser-based timeline viewer test harness that can mount the
   active viewer with fixture manifests and drive viewport resizing.
2. Add a small resize regression matrix:
   - desktop wide
   - desktop narrow
   - tablet portrait
   - mobile portrait
3. Add assertions for:
   - no clipped timeline canvas
   - visible controls without page overflow
   - axis/playhead alignment
   - vocalization chip fit on compact viewports
4. Add screenshot baselines for detections and vocalizations modes.

## Session Takeaway

This session was productive, but it depended heavily on repeated human visual
inspection. That is too expensive and too fragile for an interface that mixes
flex layout, measured DOM size, and canvas rendering.

The main improvement opportunity is not more math-unit tests. It is a stronger
DOM-focused UI test platform that validates real browser layout and resize
behavior for the active timeline viewer.
