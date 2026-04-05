# Timeline Viewer MVP Design

**Date**: 2026-04-05
**Status**: Draft
**Audience**: Humpback Annotation App contributors

## 1. Summary

This design pivots the active product surface away from the current
folder/sample annotation workflow and toward a readonly timeline viewer MVP.
The new MVP consumes exported timeline artifacts directly from static hosting,
matching the approved consumer contract in
`/Users/michael/development/humpback-acoustic-embed/docs/specs/2026-04-05-timeline-export-consumer-contract.md`
and the reference interaction model in
`/Users/michael/development/timeline-viewer.html`.

The existing annotation app, API, and DynamoDB-backed labeling work will remain
in the repository, but the annotation UI will be completely hidden from the
active application. It will not appear in routing, navigation, or default local
development flows for the new MVP.

The architectural direction remains consistent with lessons from the current
app:

- keep media and large artifacts URL-addressable
- preserve local development parity with the deployed shape
- optimize for low idle cost
- serve static app assets and exported data from the same origin
- avoid routing tiles, audio, or manifests through application compute

## 2. Context

The current repository is organized around discrete sample annotation:

- `/` lists folders
- `/folders/:folderId` lists samples
- `/samples/:sampleId` renders a detail page
- labeling and aggregate reveal are API-backed and DynamoDB-backed

That model does not match the timeline export contract, which describes a
different product:

- `/` lists exported jobs from `data/index.json`
- `/:jobId` opens a full-screen timeline viewer
- spectrogram tiles, audio chunks, and manifests are static artifacts
- the viewer is same-origin and readonly for MVP

The reference timeline UI reinforces this shift. The core experience is an
immersive analysis workspace with:

- a fixed center playhead
- zoomable spectrogram tiles
- a confidence strip
- detection overlays
- toggleable vocalization overlays
- UTC-first time presentation
- transport controls and keyboard shortcuts

This is a new primary workflow, not a small extension of the current sample
pages.

## 3. Goals

The new MVP should:

1. Replace the active app surface with a timeline-centric experience.
2. Consume timeline data directly from exported static artifacts defined by the
   approved contract.
3. Support the two primary views:
   - landing page showing available timelines
   - job timeline viewer for a selected export
4. Match the reference viewer's core interaction model:
   - zoom levels from `24h` to `1m`
   - center playhead
   - transport controls
   - confidence strip
   - detection bars
   - vocalization overlays
   - UTC labeling
5. Work against locally available exported artifacts during development without
   requiring API mediation.
6. Preserve a production-ready hosting story using CloudFront backed by S3.
7. Leave the current annotation implementation intact in the repo, but fully
   hidden from the active app.

## 4. Non-Goals

Out of scope for this MVP:

- editing detection labels
- submitting new annotations back to an API
- DynamoDB-backed timeline state
- merging the legacy annotation UI and the new viewer into one active product
- deleting the current annotation code
- introducing Cognito or other auth requirements for the readonly viewer
- generating timeline exports inside this repository

The `Label` affordance visible in the reference viewer should be treated as a
future extension, not as MVP scope.

## 5. Approaches Considered

### Approach A: Static same-origin viewer over exported artifacts

The frontend fetches `data/index.json`, `data/{jobId}/manifest.json`,
spectrogram tiles, and audio chunks directly from static hosting.

Pros:

- matches the approved consumer contract exactly
- lowest operational complexity and lowest idle cost
- strongest local-to-production parity
- no compute bottleneck for tile or audio delivery
- simplest CloudFront + S3 deployment shape

Cons:

- viewer must own more client-side loading and caching logic
- no server-side abstraction layer if the export contract changes

### Approach B: API-mediated timeline viewer

The frontend talks to the existing API, which reads manifests and proxies or
repackages timeline metadata.

Pros:

- centralizes contract adaptation on the server
- could hide filesystem or S3 layout details from the client

Cons:

- breaks the intended static-consumer model
- adds compute and cost where none is required
- weakens local parity with CloudFront + S3
- invites proxying behavior for assets that should remain URL-based

### Approach C: Dual active experience with both annotation and timeline modes

The app exposes both the existing annotation routes and the new timeline routes
in one active navigation structure.

Pros:

- preserves immediate access to legacy flows
- lowers short-term migration friction

Cons:

- dilutes product focus during the MVP reset
- makes navigation and naming more confusing
- increases implementation and QA surface
- conflicts with the explicit requirement to hide annotation UI completely

### Decision

Choose **Approach A**.

It aligns best with the approved export contract, the reference UI, the
existing repo's media-delivery lessons, and the user instruction to make the
timeline viewer the new active MVP while keeping annotation work inactive.

## 6. Proposed Architecture

### 6.1 Product Surface

The active frontend will expose only:

- `/` for the timeline landing page
- `/:jobId` for the timeline viewer page

The current routes will be removed from the mounted router:

- `/folders/:folderId`
- `/samples/:sampleId`

The corresponding code may remain in the repository for future reference or
reuse, but it will not be registered in `App.tsx`, linked from navigation, or
reachable through the default UI.

### 6.2 Runtime Shape

#### Production

```text
Browser
  │
  ▼
CloudFront
  ├─ /index.html and /assets/*      -> S3 static app bundle
  └─ /data/*                        -> S3 exported timeline artifacts
```

Key properties:

- app assets and data are same-origin
- no CORS configuration is required
- CloudFront serves the SPA shell for viewer routes like `/:jobId`
- CloudFront serves `/data/*` as ordinary static objects
- tiles, audio chunks, and manifests never pass through API compute

This preserves the earlier architectural principle that media and derived
artifacts should remain URL-addressable and CDN-backed.

#### Local Development

```text
Browser
  │
  ▼
Vite dev server
  ├─ frontend app bundle
  └─ /data/* mounted from a local export directory
```

Local exported artifacts are expected to exist on disk outside or inside the
repo. The frontend should consume them the same way it would in production:

- `GET /data/index.json`
- `GET /data/{jobId}/manifest.json`
- `GET /data/{jobId}/tiles/...`
- `GET /data/{jobId}/audio/...`

Recommended local mechanism:

- introduce a `TIMELINE_EXPORT_ROOT` environment variable
- configure Vite dev middleware to serve that directory at `/data`
- keep the URL shape identical between local and production

This avoids inventing a separate local API path and keeps the viewer contract
stable.

### 6.3 Data Sources

The new viewer will rely on the export contract as the source of truth.

Landing page:

- fetch `/data/index.json`
- render a list of available timeline jobs

Viewer page:

- fetch `/data/{jobId}/manifest.json`
- validate `manifest.version === 1`
- derive tile and audio URLs from the manifest using the contract formulas

If the manifest version is unsupported or required fields are missing, the
viewer should show a clear error state instead of attempting partial rendering.

### 6.4 Page Model

#### Landing Page

Purpose:

- provide a simple entry point into available exported timelines

Core content:

- list of timeline jobs from `index.json`
- hydrophone name
- species
- start and end timestamps
- link into `/:jobId`

Design direction:

- cleaner and more product-specific than the current folder list
- lightweight and fast-loading
- optimized for scanning jobs, not browsing individual clips

#### Timeline Viewer Page

Purpose:

- provide the primary analysis workspace for a single exported job

Layout regions:

1. Header
   - back to jobs
   - hydrophone name
   - job date range
   - persistent UTC context
2. Main viewport
   - frequency axis
   - spectrogram tile canvas/layer
   - fixed center playhead
   - confidence strip
   - time axis
3. Controls footer
   - play/pause
   - skip backward/forward
   - playback rate
   - zoom controls
   - zoom level chips
   - overlay toggles
   - frequency-range badge

The page should be immersive and tool-like, matching the reference viewer more
than the current document-style sample detail page.

## 7. UI and Interaction Design

### 7.1 Core Interaction Model

The viewer is organized around a `centerTimestamp`.

Everything in the viewport is derived from that center:

- visible tile window
- visible detections
- visible vocalization labels
- current audio chunk
- time-axis labels
- center playhead readout

Panning changes `centerTimestamp`.
Playback advances `centerTimestamp`.
Zoom changes the viewport span and visible tile set.

### 7.2 Zoom Behavior

Supported zoom levels:

- `24h`
- `6h`
- `1h`
- `15m`
- `5m`
- `1m`

The viewer should implement the viewport spans described in the consumer
contract. At `1h` and below, multiple tiles may be visible at once.

Target behavior:

- chip-based zoom selection
- keyboard `+` and `-`
- smooth transitions between zoom layers
- preload adjacent tiles at the active zoom level

### 7.3 Spectrogram Rendering

Recommended implementation:

- render tiles inside a canvas-backed or layered image viewport
- maintain an in-memory LRU cache for loaded tile images
- compute visible tile indices from `centerTimestamp`, zoom level, and viewport
  span

Design rules:

- use the exported PNGs as-is
- do not re-color tiles in the browser
- preserve the fixed 0-3000 Hz framing in the UI

### 7.4 Confidence Strip

The confidence strip should render below the spectrogram using the manifest's
`window_sec` and `scores`.

Behavior:

- use the provided gradient mapping
- render `null` windows as transparent or muted
- keep it horizontally aligned with the spectrogram timeline

### 7.5 Detection Overlay

Detection bars should render over the timeline using time-based positioning.

Behavior:

- color labeled rows by label type
- render unlabeled rows with neutral color and confidence-based alpha
- show a tooltip with label, UTC range, average confidence, and peak
  confidence on hover

### 7.6 Vocalization Overlay

Vocalization labels should be a separate toggleable layer.

Behavior:

- group labels by time window
- render manual labels as filled badges
- render inference labels as outlined badges
- derive colors from `vocalization_types` order, not from persisted viewer
  state

### 7.7 Audio Playback

The viewer should implement gapless chunk playback using two hidden audio
elements.

Responsibilities:

- map timestamps to chunk indices
- preload the current and next chunk
- swap buffers at chunk boundaries
- fall back cleanly if the next chunk is not ready
- keep the playhead centered while audio advances

The viewer is readonly, so playback is the primary active control path.

### 7.8 Keyboard and Pointer Support

MVP keyboard support:

- `Space` toggles play/pause
- `+` and `-` adjust zoom
- left/right arrows pan by 10% of viewport span

Pointer support:

- click or drag to pan the viewport
- hover to inspect detections
- click zoom chips and transport controls

### 7.9 Responsive Behavior

The viewer is desktop-first, but should remain usable on smaller screens.

Requirements:

- preserve the central playhead model on mobile
- keep controls reachable without horizontal overflow
- allow the viewport to shrink while maintaining readable time labels
- degrade gracefully if overlay density becomes too high at narrow widths

## 8. Reuse From the Existing App

The previous annotation app provides useful architectural lessons even though
its workflow is being shelved.

We should preserve these lessons:

- use React + Vite for the frontend shell
- keep static and media content URL-based
- maintain strong local-to-production parity
- avoid introducing compute for asset delivery
- keep the app deployable as a static bundle behind CloudFront

We should not carry forward these active product assumptions:

- folder/sample browse as the top-level UX
- sample detail pages as the main work surface
- user label submission as the core action
- aggregate reveal as the primary outcome

## 9. Legacy Annotation Handling

The existing annotation implementation stays in the repository but is no longer
part of the active product.

Design requirements:

- remove annotation routes from the active router
- remove navigation affordances that expose annotation pages
- do not present annotation terminology in the new primary UI
- do not delete the code yet

This keeps the repository history and earlier work intact while making the new
MVP unambiguous.

## 10. Implementation Implications

This design shifts the center of gravity of the repo:

- `frontend/` becomes the main implementation area for MVP progress
- `api/` and DynamoDB remain present but are no longer on the critical path
  for the active experience
- local development should not require DynamoDB or the API to view exported
  timelines

Expected frontend work areas:

- routing and app shell rewrite
- timeline index page
- timeline viewer page
- manifest/index loaders
- tile cache and viewport math
- audio playback controller
- overlay rendering
- Vite local static mount for exported artifacts

Expected documentation work:

- `README.md`
- `STATUS.md`
- `MEMORY.md`
- possibly `DECISIONS.md` if this pivot is accepted as a material architectural
  change

## 11. Risks and Mitigations

### Risk 1: Viewer complexity is underestimated

Why it matters:

- synchronized pan/zoom/audio/overlay behavior is more complex than the
  current sample pages

Mitigation:

- phase implementation so landing page and manifest loading ship before full
  overlay polish
- isolate timeline math and playback coordination into testable utilities

### Risk 2: Local artifact serving diverges from production

Why it matters:

- a custom local-only path shape would create bugs that do not reproduce once
  deployed to CloudFront + S3

Mitigation:

- keep `/data/*` identical in local and production
- mount local exports directly at `/data` in Vite

### Risk 3: Legacy routes remain accidentally reachable

Why it matters:

- mixed workflows would confuse the MVP narrative and inflate testing surface

Mitigation:

- remove legacy routes from the mounted router
- verify there are no visible links into legacy pages

### Risk 4: Contract version drift

Why it matters:

- the viewer depends on an external export schema

Mitigation:

- centralize manifest typing and version checks
- fail clearly on unsupported versions

## 12. Recommended Delivery Sequence

1. Replace the app router and shell with the new timeline-first structure.
2. Add local `/data` mounting and landing-page loading from `index.json`.
3. Implement the job viewer shell with header, timeline canvas region, and
   controls.
4. Add tile loading and viewport math.
5. Add confidence strip, detection overlay, and vocalization overlay.
6. Add double-buffered audio playback and keyboard shortcuts.
7. Remove remaining annotation UI references from active copy and docs.

This sequencing keeps the product visibly aligned with the pivot early, even
before advanced overlay behavior is complete.

## 13. Verification Strategy

Design-level acceptance for the eventual implementation:

- the app boots without API or DynamoDB when local exported artifacts are
  available
- `/` renders timelines from `data/index.json`
- `/:jobId` renders from `data/{jobId}/manifest.json`
- tile and audio URLs are fetched directly from same-origin static paths
- unsupported manifest versions show a clear error state
- annotation UI is not reachable from the active app
- the app still builds with `pnpm typecheck` and `pnpm build`

Additional targeted checks should cover:

- viewport-to-time math
- zoom transitions
- audio chunk boundary behavior
- detection tooltip rendering
- local artifact mount behavior

## 14. Open Questions

Open questions are intentionally narrow at this stage:

1. Should the local export root default to a known path when
   `TIMELINE_EXPORT_ROOT` is unset, or should the app fail fast with setup
   instructions?
2. Should the initial MVP include a polished empty state for zero timelines, or
   is a simple informational message sufficient?

These questions do not block the overall direction.
