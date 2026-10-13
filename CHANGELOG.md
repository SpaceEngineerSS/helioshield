# Changelog

## 2.0.0 — 2026-10-13

A rebuild. Version 1 looked busy, but most of what the README promised was not actually running, and by autumn 2026 its live data had stopped working. This release starts from the data and works outward.

### Fixed

- **Live data works again.**
  - NOAA retired the 7-day solar wind products. v2 reads the RTSW 1-minute feeds.
  - The Kp product changed format. The new format is parsed.
  - DONKI moved to CCMC. v2 uses the new keyless endpoint.
- **No more invented data.** When a feed failed, v1 swapped in a random synthetic preset and labelled it as live. Missing data now shows as missing.
- **Kp estimate.** The old log-linear map put ordinary conditions at G2. It was replaced by a model fitted on 20 years of OMNI data and tested on 2020–2025: RMSE 0.69.
- **CME arrival.** The launch time and launch radius no longer disagree, which made every arrival ~6 h early. "Earth-directed" is now decided by cone geometry instead of CME width.
- **Flares and radio blackouts** now follow NOAA's R-scale and SWPC's own flare list. 1-minute X-ray noise is no longer counted as flares.
- **Aurora boundary** uses a proper dipole conversion instead of a fixed −9.35° offset.
- **Playback.** v1 advanced in real time (a 24 h window took 24 h) and re-rendered the whole app every frame.
- **API key.** v1 shipped a NASA API key inside the public bundle. v2 needs no keys.

### Added

- **Replays of five historic storms** from archived OMNI, GFZ and DONKI data:
  - Halloween 2003
  - St. Patrick's Day 2015
  - September 2017
  - Gannon (May 2024)
  - October 2024

  Each replay comes with a short story, key numbers, and a live model-vs-observed score. Links can point to a moment in a replay.
- **Aurora panel.** Chance of seeing it from your location, the next dark-sky window, and a polar map of OVATION probabilities.
- **NOAA bulletins**, with optional browser notifications when Kp crosses a threshold you set.
- **CME tracker**, showing the drag-based arrival window next to CCMC's ENLIL run.
- **Three-day outlook** of Kp and the G/R/S scales.
- **Turkish interface,** alongside English.
- **Paper theme,** alongside the default night theme.
- **Vercel edge feed.** One cached request per feed serves every visitor and cuts the client download from ~4 MB to ~70 kB a minute.
- **Offline start** from the last good data (IndexedDB plus the service worker).

### Changed

- **New interface,** designed as an observatory instrument panel, with a new logo, icons and social card.
- **Faster everywhere.**
  - Charts moved to canvas (uPlot).
  - The 3D scene renders only when something moves, stops when off screen, picks a quality tier per device, and falls back to SVG without WebGL.
  - Parsing runs in a Web Worker.
  - Initial JavaScript is ~135 kB gzipped.
- **Accessibility.** Keyboard control of the timeline, visible focus, WCAG AA contrast in both themes, and 44 px touch targets.

### Removed

Modules that the app never imported, several of which were also wrong:
- the GIC calculator and worker
- the simulation orchestrator
- the sensitivity analysis
- a second Kp mapping
- an adaptive RK4 engine
- the unused shaders and vector-field component
- the synthetic presets

## 1.0.0 — 2026-04-28

First public release.
