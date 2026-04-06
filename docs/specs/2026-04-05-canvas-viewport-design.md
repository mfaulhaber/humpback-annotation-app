# Canvas Viewport Design

**Date**: 2026-04-05
**Status**: Draft
**Audience**: Humpback Timeline Viewer contributors

## 1. Summary

This design replaces the active timeline viewer's DOM-positioned viewport with
a canvas-backed renderer while keeping the surrounding page chrome, controls,
and readonly product semantics intact. The main goal is to make playback
scrolling feel smooth at fine zoom levels, especially `5m` and `1m`, where the
current viewport visibly jumps instead of tracking the playback clock fluidly.

The refactor should stay compatible with the current static export contract:
same-origin `data/{jobId}/manifest.json`, spectrogram tiles under
`data/{jobId}/tiles/*`, and chunked audio under `data/{jobId}/audio/*`.

## 2. Context

The current viewer composes the playback and viewport state like this:

- `useTimelinePlayback()` updates `currentTimestamp`
- the timestamp is primarily advanced from the audio element's `timeupdate`
  event
- `TimelineViewerPage` copies that playback timestamp into
  `centerTimestamp`
- `TimelineViewport` re-renders absolutely positioned DOM elements for tiles,
  overlays, and axis markers

This is correct enough for seek stability, but it is not a good rendering model
for smooth motion:

- browser `timeupdate` events are intentionally low frequency and irregular
- at `5m` and `1m` zoom, each timestamp jump moves the viewport a noticeable
  number of pixels
- the DOM renderer repositions multiple elements every update, which makes
  the coarse playback clock even more obvious

The result matches the observed bug: the audio clock progresses, but the
timeline scroll looks jerky instead of smoothly following the playhead.

## 3. Goals

The refactor should:

1. make playback scrolling visually smooth at all zoom levels, with special
   attention to `5m` and `1m`
2. keep the viewport centered on the playback position while audio is playing
3. preserve drag-to-preview, click-to-seek, and drag-commit interactions
4. preserve same-origin static tile and audio loading
5. keep detection and vocalization overlays aligned with the time axis
6. avoid turning the whole app into an imperative canvas application

## 4. Non-Goals

Out of scope for this change:

- changing the export manifest or tile/audio URL contract
- editing detections or vocalization labels
- introducing an API-backed timeline surface
- rewriting the whole page, controls, or navigation to canvas
- adding WebGL, workers, or an offscreen rendering pipeline unless a later
  change proves they are necessary
- touching the dormant annotation/API stack

## 5. Approaches Considered

### Approach A: Hybrid canvas viewport with a live playback clock

Use a canvas-backed viewport for the scroll-heavy rendering path, but keep the
rest of the app in React/DOM. Replace the viewport's dependence on low-rate
`timeupdate`-driven React renders with a live playback clock that can be sampled
inside `requestAnimationFrame`.

Pros:

- directly addresses the visible jerkiness
- keeps the refactor focused on the viewport instead of the whole app
- preserves the current static hosting and audio-chunk model
- gives fine-grained control over tile and overlay drawing
- keeps page-level accessibility and chrome in the DOM

Cons:

- introduces more imperative drawing logic
- requires explicit hit-testing for canvas-rendered overlays
- needs careful DPR handling and redraw discipline

### Approach B: Keep the DOM viewport and add animation-frame interpolation

Continue rendering tiles and overlays as DOM/SVG elements, but interpolate the
playback position between `timeupdate` events.

Pros:

- smaller diff than a full viewport renderer change
- preserves the existing element structure

Cons:

- still pays the cost of repositioning many DOM nodes during playback
- leaves the most motion-sensitive path in a rendering model that is already
  showing limits
- likely becomes a partial fix rather than a durable one

### Approach C: Full custom rendering engine or WebGL viewer

Move the viewport to a heavier custom graphics stack.

Pros:

- maximum performance ceiling
- room for future advanced interactions

Cons:

- too large for the current scope
- introduces complexity without evidence that 2D canvas is insufficient
- increases implementation and maintenance risk

## 6. Decision

Choose **Approach A**.

The current problem is specifically about smooth viewport motion while
preserving the existing readonly timeline product. A hybrid canvas viewport is
the smallest architectural shift that directly matches that need.

## 7. Proposed Design

### 7.1 Rendering Boundary

Keep these parts in DOM/React:

- page layout and navigation
- playback controls
- zoom controls and toggles
- header metadata
- tooltip containers and axis labels where text rendering is clearer in DOM
- centered playhead chrome if it remains visually simpler as DOM

Move these parts to canvas:

- spectrogram tile drawing
- viewport grid and background
- detection bars
- vocalization windows or other time-aligned overlay primitives

### 7.2 Playback Clock Model

`useTimelinePlayback()` should remain the owner of:

- audio element refs
- chunk loading and prefetch
- play / pause / seek orchestration
- chunk handoff at boundaries

It should also expose a **live playback timestamp reader** derived from the
currently active audio element, current chunk index, and `audio.currentTime`.

That live timestamp should be usable by the viewport without forcing the whole
React tree to re-render at animation-frame cadence.

This separates two roles that are currently coupled:

- coarse React state for status, controls, and manual seeks
- high-frequency render-time clock sampling for smooth viewport motion

### 7.3 Canvas Viewport Model

The canvas viewport should:

- size its backing store using device pixel ratio
- reuse the existing tile cache and draw decoded tile images with `drawImage`
- compute visible tiles from the existing manifest and zoom math
- draw overlays from precomputed geometry derived from manifest detections and
  vocalization labels
- redraw on:
  - width changes
  - zoom changes
  - overlay toggle changes
  - manual preview/seek changes
  - animation frames while playback is active

The viewport should not depend on full React re-render cycles for every visual
position update during playback.

### 7.4 Interaction Model

The current interaction semantics should stay intact:

- pointer drag previews a different center timestamp
- pointer release commits a seek
- click commits a seek
- keyboard controls still seek, zoom, and toggle playback

For hover or selection affordances on canvas-rendered overlays, the viewport can
reuse precomputed geometry for hit testing and then position an existing DOM
tooltip using the current viewport mapping.

### 7.5 Expected Performance Outcome

This change should improve playback smoothness because:

- the viewport will no longer wait for browser-throttled `timeupdate` events to
  advance its visual position
- the heaviest moving surface will be drawn in canvas instead of being composed
  from many individually positioned DOM nodes
- fine zoom levels will sample the audio clock often enough for visually
  continuous motion

## 8. Risks and Mitigations

### Risk: Canvas text and tooltip quality is worse than DOM

Mitigation:

- keep axis labels and tooltips in DOM unless there is a strong reason to move
  them

### Risk: Tile loading or decoding still causes hitches

Mitigation:

- keep the existing tile cache
- continue prefetching visible and overscan tiles
- isolate renderer logic so later optimizations do not require product-level
  rewrites

### Risk: Canvas interaction code becomes hard to reason about

Mitigation:

- keep geometry helpers pure and well tested
- preserve the existing `TimelineViewport` component boundary where practical
- keep the canvas refactor focused on rendering and hit testing, not unrelated
  viewer behavior

## 9. Validation

Implementation should be considered successful when:

- playback appears smooth at `15m`, `5m`, and `1m`
- the visible viewport stays aligned with the UTC clock and centered playhead
- seeking and chunk transitions still land on the correct timestamps
- overlays remain aligned with the spectrogram and time axis
- the viewer still works from same-origin static artifacts with no API changes
