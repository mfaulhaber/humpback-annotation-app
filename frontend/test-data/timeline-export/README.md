# UI Test Timeline Export Fixture

This directory contains the committed export fixture used by the browser-based
UI regression suite.

## Source

The fixture is derived from the real export rooted at:

- `/Volumes/External_2TB/data/exports`

The committed fixture keeps the real `index.json` and real
`8224c4a6-bc36-43db-ad59-e8933ef09115/manifest.json` so the viewer still loads
an authentic export contract shape.

## Why It Is Partial

The source export is about `3.7G`, with:

- one full-day job
- `11,094` spectrogram tile PNGs
- `288` audio chunks

That is too large and machine-specific for repo-managed automation. This
fixture trims the export to a deterministic subset that stays small enough for
committed browser tests.

## Included Assets

The fixture intentionally includes only the spectrogram tile subset needed for:

- the default `1h` viewer load around noon
- the high-signal `02:05 UTC` hotspot used by the UI visual tests across
  `24h`, `6h`, `1h`, `15m`, `5m`, and `1m`

Included tile ranges:

- `24h`: `0`
- `6h`: `0-2`
- `1h`: `7-17` and `67-77`
- `15m`: `45-55`
- `5m`: `145-155`
- `1m`: `745-755`

Audio files are intentionally not committed. The default automated browser
suite keeps playback paused and focuses on layout, resize behavior, and visual
alignment. The opt-in smoke lane can run against a real external
`TIMELINE_EXPORT_ROOT` when full audio and full export density are needed.
