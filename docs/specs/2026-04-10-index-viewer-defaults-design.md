# Timeline Index Viewer Defaults Design

**Date**: 2026-04-10
**Status**: Draft
**Audience**: Humpback Timeline Viewer contributors

## 1. Summary

Extend `data/index.json` so each exported job may optionally define its initial
viewer state:

- `starting_pos`: initial playhead position
- `zoom_level`: initial timeline zoom
- `view_mode`: initial overlay mode

These fields should let an export author open a job directly into a useful
review state without changing the manifest contract or introducing API
mediation. The viewer should continue to work for existing exports that do not
provide these fields. The same state should also be expressible in `/:jobId`
query params so links can preserve or override those defaults.

## 2. Context

Today the landing page reads `data/index.json`, but the viewer route loads only
`data/{jobId}/manifest.json`. Initial viewer state is derived entirely inside
`TimelineViewerPage`:

- zoom defaults to the closest available level to `1h`
- the centered playhead defaults to the manifest-derived noon-UTC heuristic
- overlay mode defaults to `detections`

That behavior is safe, but it forces every job to open the same way even when
an export author already knows the most useful starting location. The existing
`hints` field partially works around that by asking the user to manually pan,
zoom, and toggle overlays after load.

This design turns those manual directions into optional structured metadata in
the index contract.

## 3. Goals

This change should:

1. keep `index.json` backward compatible for existing exports
2. let a job define an initial playhead position, zoom level, and overlay mode
3. preserve direct `/:jobId` route loading without requiring navigation from
   the landing page first
4. keep the manifest schema unchanged
5. preserve current viewer fallbacks when defaults are missing, unsupported, or
   unavailable
6. allow explicit URL query params to override export-provided defaults when a
   link needs a different initial view

## 4. Non-Goals

Out of scope for this design:

- adding autoplay
- storing persistent per-user viewer preferences
- changing the manifest contract
- introducing deep-link query parameters as the main export contract
- changing overlay semantics beyond the initial selected mode

## 5. Approaches Considered

### Approach A: Add flat optional fields directly to each `index.json` job entry

Example shape:

```json
{
  "job_id": "8224c4a6-bc36-43db-ad59-e8933ef09115",
  "hydrophone_name": "Orcasound Lab",
  "species": "ar-v2-promoted",
  "start_timestamp": 1711929600,
  "end_timestamp": 1711936800,
  "hints": "Open the vocalization cluster around 01:05 UTC.",
  "starting_pos": 1711933500,
  "zoom_level": "5m",
  "view_mode": "vocalizations"
}
```

Pros:

- matches the requested field names exactly
- minimal change to the existing index contract
- consistent with the existing optional `hints` pattern
- easy for export writers to author and inspect by hand

Cons:

- adds more viewer-specific fields at the top level of each entry
- is less future-proof than grouping viewer settings under one object

### Approach B: Add a nested `initial_view` object

Example shape:

```json
{
  "job_id": "8224c4a6-bc36-43db-ad59-e8933ef09115",
  "initial_view": {
    "starting_pos": 1711933500,
    "zoom_level": "5m",
    "view_mode": "vocalizations"
  }
}
```

Pros:

- keeps viewer-specific metadata namespaced
- scales more cleanly if more view defaults are added later

Cons:

- does not match the requested flat field shape
- is more verbose for a small three-field addition
- differs from the existing `hints` precedent on timeline entries

### Approach C: Keep `index.json` unchanged and encode defaults in route params

Examples:

- `/:jobId?starting_pos=...&zoom_level=...&view_mode=...`
- React navigation state from the landing page

Pros:

- avoids extending the export file contract
- creates shareable ad hoc deep links

Cons:

- does not satisfy the request to extend `index.json`
- direct loads of `/:jobId` would not know the export-author defaults unless
  the URL also carries them
- React navigation state would be lost on refresh and copy/paste
- duplicates job metadata between the index and the URL

### Decision

Choose **Approach A**.

It best matches the requested contract, follows the existing `hints` pattern,
and keeps the export-controlled defaults simple and backward compatible.

## 6. Proposed Contract

Extend `TimelineEntry` with three optional fields:

```ts
interface TimelineEntry {
  job_id: string;
  hydrophone_name: string;
  hints?: string;
  species: string;
  start_timestamp: number;
  end_timestamp: number;
  starting_pos?: number;
  zoom_level?: ZoomLevel;
  view_mode?: "detections" | "vocalizations";
}
```

### Field semantics

#### `starting_pos`

- optional integer Unix timestamp in UTC seconds
- represents the initial centered playhead timestamp
- should use the same time basis as `start_timestamp`, `end_timestamp`, and the
  manifest job timestamps
- should not be interpreted as a pixel offset, percentage, or formatted clock
  string

Recommended validation:

- value must be a finite integer number
- value should satisfy
  `start_timestamp <= starting_pos <= end_timestamp`

Runtime safety:

- even when present, the viewer should clamp the final value to the manifest
  range before using it

#### `zoom_level`

- optional enum with allowed values:
  `1m | 5m | 15m | 1h | 6h | 24h`
- represents the preferred initial zoom target for that job

Runtime safety:

- if the requested zoom is not available in the manifest, the viewer should use
  `preferredInitialZoom(manifest, requestedZoom)` to choose the nearest
  supported level

#### `view_mode`

- optional enum with allowed values: `detections | vocalizations`
- selects the initial overlay mode for the viewer
- does not introduce `none` into the export contract

Runtime safety:

- if absent, default to `detections`
- if the chosen layer has no visible items, keep the requested mode rather than
  silently switching to another one

## 7. Viewer Resolution Rules

The viewer should resolve initial state in this order:

1. load `manifest.json` for the selected job
2. attempt to load `index.json` and find the matching `job_id`
3. parse any supported query params from `location.search`
4. derive initial state from the matching entry when optional fields are
   present
5. apply query-param overrides on top of the entry-derived defaults
6. fall back to current manifest-derived defaults when neither source provides
   a value

Recommended initial-state algorithm:

```ts
const entry = findTimelineEntry(index, jobId);
const queryDefaults = parseTimelineViewSearchParams(
  new URLSearchParams(location.search),
);
const initialDefaults = mergeTimelineViewDefaults(entry, queryDefaults);

const initialCenterTimestamp = clampTimestamp(
  manifest,
  initialDefaults.starting_pos ?? initialTimelineCenterTimestamp(manifest),
);

const initialZoom = initialDefaults.zoom_level
  ? preferredInitialZoom(manifest, initialDefaults.zoom_level)
  : preferredInitialZoom(manifest, "1h");

const initialOverlayMode: TimelineOverlayMode =
  initialDefaults.view_mode ?? "detections";
```

## 8. Loading Strategy

Because the job viewer route can be opened directly, `TimelineViewerPage`
should not rely only on `Link` state from the landing page.

Recommended behavior:

- treat `manifest.json` as required
- treat `index.json` as optional enhancement data for initial viewer defaults
- treat supported query params as optional explicit overrides for those defaults
- fetch both concurrently on the viewer page
- if the manifest load fails, show the existing viewer error state
- if the index load fails, log and continue with current default viewer
  behavior

This preserves direct-link robustness while still allowing export authors to
control the initial viewer state through `index.json`.

## 8.1 Query Param Contract

Supported query params:

- `starting_pos`
- `zoom_level`
- `view_mode`

Semantics:

- the names and value shapes intentionally match the `index.json` fields
- home-page links should include these params when a job entry defines them
- explicit query params should override the matching values from `index.json`
- invalid query params should be ignored rather than causing viewer failure

## 9. User Experience Notes

- The new fields replace part of what `hints` currently asks the user to do
  manually, but `hints` still remains useful for descriptive guidance.
- No autoplay should be added; these defaults affect only the initial paused
  state and the first playback start point.
- The initial timecode shown in the controls should reflect the resolved center
  timestamp from `starting_pos` when present.
- Existing jobs without these fields should continue to open exactly as they do
  today.

## 10. Validation and Error Handling

For contract validation:

- valid jobs with no new fields must still pass
- valid jobs with any subset of the new fields must pass
- invalid `zoom_level` or `view_mode` values should fail index validation
- invalid non-numeric `starting_pos` should fail index validation

Recommended additional guard:

- reject non-integer `starting_pos` values in the validator so exporters do not
  accidentally provide millisecond timestamps

For runtime behavior:

- missing matching job entry in `index.json` should not block viewer loading
- unsupported requested zoom should degrade to the nearest available zoom
- out-of-range `starting_pos` should clamp to the manifest range

## 11. Implementation Impact

Likely touched areas in implementation:

- `frontend/src/lib/timeline-contract.ts`
  - extend `TimelineEntry`
  - add validation for the new fields
- `frontend/src/lib/timeline-contract.test.ts`
  - add acceptance and rejection cases
- `frontend/src/lib/timeline-test-fixtures.ts`
  - add fixture coverage for the new fields
- `frontend/src/pages/TimelineViewerPage.tsx`
  - resolve viewer defaults from the matching index entry
- `frontend/src/api/timeline.ts`
  - optionally add a small helper for fetching the viewer bootstrap data
- `README.md`
  - document the new optional `index.json` fields and example usage
- browser tests
  - verify initial zoom, overlay mode, and timecode/default position behavior

## 12. Verification Strategy

Implementation verification should include:

1. contract unit tests covering valid and invalid index entries
2. viewer tests covering:
   - no defaults present
   - `starting_pos` only
   - `zoom_level` only
   - `view_mode` only
   - unsupported requested zoom falling back to the nearest available level
3. baseline repo verification:
   - `pnpm typecheck`
   - `pnpm build`
   - `pnpm test`
4. `pnpm test:ui` if the implementation path changes route-level initial viewer
   state in a way the Playwright suite can assert

## 13. Open Question Resolved for This Design

This design treats `starting_pos` as an absolute UTC timestamp in Unix seconds,
not as a relative offset from the job start.

Why:

- the current viewer state already uses absolute timestamps everywhere
- the manifest and index already express job bounds in absolute Unix seconds
- absolute timestamps are easier to validate and debug against exported data
- this avoids introducing a second time coordinate system just for initial
  state
