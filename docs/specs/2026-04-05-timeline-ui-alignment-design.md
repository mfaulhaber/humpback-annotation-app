# Timeline UI Alignment Design

**Date**: 2026-04-05
**Status**: Draft
**Audience**: Humpback Timeline Viewer contributors

## 1. Summary

This design aligns the active timeline viewer with the two screenshot
references supplied in the planning conversation. The goal is not to replace
the viewer's readonly interaction model or static export contract, but to
retune the visual hierarchy so the spectrogram viewport feels more immersive
and the lower-edge overlays feel intentionally designed rather than bolted on.

The screenshots suggest three concrete shifts:

1. detections should read as a slim integrated band near the bottom of the
   viewport
2. vocalizations should feel denser and more compact, with styling that
   belongs to the same visual system as the detection band
3. the playhead, axis, and viewport should carry more of the structure while
   surrounding chrome becomes quieter

## 2. Context

The current active viewer already has the correct product shape:

- static same-origin manifest, tile, and audio loading
- a centered playhead
- a canvas-backed spectrogram viewport
- detection and vocalization overlays
- zoom, seek, and playback controls in DOM

What feels off relative to the reference images is the visual composition:

- detections currently render as thicker rects in a dedicated lower band
- vocalizations are drawn in the upper viewport area, which competes with the
  spectrogram instead of complementing it
- the confidence strip, axis, and stage chrome read as separate stacked
  widgets instead of one coordinated timeline surface
- the outer viewer chrome remains stronger than the screenshots imply

The user clarified that the second image is the "detections view," which means
the target direction should treat the bottom integrated band as the visual
language for detections and tune vocalizations to sit coherently alongside it.

## 3. Goals

This pass should:

1. restyle detections into a thin, bottom-aligned, segmented band that feels
   integrated with the viewport
2. restyle vocalizations so they are compact, lower in the viewport, and
   visually compatible with the detections treatment
3. make the centered playhead and time axis more visually authoritative
4. reduce unnecessary chrome so the spectrogram remains the focus
5. preserve current readonly behavior, playback semantics, and manifest/media
   URL contracts
6. keep the viewer usable on desktop and narrower laptop widths

## 4. Non-Goals

Out of scope for this change:

- changing the export manifest schema
- editing detections or vocalization labels
- touching the dormant annotation API or DynamoDB stack
- introducing a new product workflow or navigation model
- fabricating spectrogram data effects that are not present in the source
  tiles
- removing keyboard playback and seek affordances

## 5. Approaches Considered

### Approach A: Viewport-first overlay alignment pass

Keep the current viewer architecture, but change the overlay geometry,
renderer styling, axis placement, and surrounding chrome so the viewport reads
more like the screenshots.

Pros:

- matches the actual feedback, which is primarily about the visual language
- preserves the current canvas/DOM architecture
- focuses engineering effort on the parts the user sees most directly
- keeps the export contract and playback behavior untouched

Cons:

- still requires real renderer and layout changes, not just CSS tweaks
- needs careful coordination between canvas drawing and DOM controls

### Approach B: CSS-only reskin on top of the current geometry

Keep detection and vocalization placement exactly as-is and only restyle colors,
radius, shadows, and spacing.

Pros:

- smallest implementation diff
- lower regression risk

Cons:

- does not match the screenshots well enough
- leaves vocalizations in the wrong part of the viewport
- keeps detections reading as a separate overlay instead of an integrated band

### Approach C: Full viewer shell redesign

Redesign the whole viewer page, including a new transport/control model and a
substantially different shell around the viewport.

Pros:

- highest fidelity to the visual inspiration if taken very far
- room for a more opinionated product surface

Cons:

- too broad for the requested tweak pass
- adds risk outside detections, vocalizations, and viewport composition
- makes it harder to preserve the existing tested interactions

## 6. Decision

Choose **Approach A**.

The screenshots are strong enough to justify geometry and composition changes,
but not a ground-up product-shell rewrite. A focused viewport-first alignment
pass gives us the right level of change.

## 7. Proposed Design

### 7.1 Viewer Composition

Treat the viewport as the primary visual object on the page:

- keep the current viewer shell and transport controls, but tone down heavy
  panel treatment where possible
- keep the playhead centered and visually prominent
- make the lower portion of the viewport feel like one coordinated information
  zone: detections, vocalizations, and time axis should relate to each other
  instead of looking like separate widgets

This design assumes the screenshots are viewport references, not full-page
mockups. The implementation should therefore focus on the timeline stage first
and make only light shell adjustments unless the work reveals an obvious
follow-up improvement.

### 7.2 Detection Styling

Detections should move toward the second screenshot's treatment:

- render as a slimmer band close to the viewport bottom edge
- use flatter segmented blocks with less vertical weight
- rely on color, width, and subtle outline contrast instead of taller bars
- keep hover affordances available, but avoid letting tooltips dominate the
  frame

The band should still represent the same time-aligned detection data. This is
purely a presentation change, not a semantics change.

### 7.3 Vocalization Styling

Vocalizations should be reworked to feel consistent with the first screenshot:

- move away from floating top-of-viewport chips
- use compact chips or tags positioned in lower stacked lanes above the axis
  and detection band
- keep overlap handling predictable so dense windows remain readable
- tighten label sizing, spacing, and padding so the overlay can stay dense
  without covering too much spectrogram area

The vocalization treatment should share the same color and border language as
the detection band, while remaining distinguishable from it.

### 7.4 Axis, Playhead, and Lower-Edge Hierarchy

The screenshots make the center playhead and time axis do more structural work
than the current implementation.

The alignment pass should therefore:

- keep the playhead bright and crisp
- preserve the center marker at the top edge
- make the bottom time readout feel visually tied to the viewport rather than
  detached below it
- review whether the confidence strip should be visually absorbed into the
  lower-edge system or de-emphasized so detections remain legible

### 7.5 Color and Finish

Use the screenshots as the visual direction for finish, not as a literal color
match target:

- cooler spectrogram-adjacent tones
- lower-contrast chrome around the stage
- bright aqua for the playhead/current-time emphasis
- compact high-legibility colors for detections and vocalizations
- fewer heavy shadows and less "card" separation inside the viewer

We should not synthesize artificial dark vertical seams or other spectrogram
features that are actually part of the source image data.

## 8. Risks and Mitigations

### Risk: Lower overlays become too dense to read

Mitigation:

- keep lane assignment deterministic
- use truncation and tighter chip sizing only where necessary
- preserve hover or tooltip detail for dense regions

### Risk: Detection hit areas become too small after slimming the band

Mitigation:

- use geometry-based hit testing with a small tolerance
- allow hover targeting to be slightly more forgiving than the visible rect

### Risk: We overfit to cropped screenshots and accidentally worsen the full page

Mitigation:

- treat the screenshots as viewport references first
- keep shell-level changes intentionally modest during this pass
- verify the full viewer at normal desktop widths before finalizing

## 9. Validation

The implementation should be considered aligned when:

1. detections read visually as a slim integrated lower band
2. vocalizations feel compact and coordinated with the lower overlay system
3. the playhead and time axis remain easy to track during playback
4. playback, seek, zoom, and overlay toggles still behave correctly
5. the full viewer still feels intentional outside the cropped viewport area

## 10. Assumptions to Confirm During Implementation

- The screenshot references are inspiration for the timeline stage, not a
  requirement to clone every page-level layout choice.
- Detections and vocalizations should be adjusted together in the same pass so
  they share one visual language.
- No manifest or API changes are required for this effort.
