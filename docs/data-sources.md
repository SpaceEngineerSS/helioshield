# Data sources

All feeds are public and keyless. The registry is `src/data/sources.ts`, and each feed has a parser in `src/data/transform.ts` and a test against a trimmed real payload in `src/data/transform.test.ts`.

## Live feeds

| Feed id | Upstream | Refresh | Used for |
|---|---|---|---|
| `solarwind` | SWPC `json/rtsw/rtsw_wind_1m.json` + `rtsw_mag_1m.json` | 60 s | Speed, density, temperature, Bt, By, Bz (GSM). Only rows marked `active` (the spacecraft SWPC uses at that minute: DSCOVR, ACE or IMAP). |
| `kp` | SWPC `products/noaa-planetary-k-index-forecast.json` | 10 min | Past week observed, today estimated, next 3 days predicted |
| `kpnow` | SWPC `json/planetary_k_index_1m.json` | 60 s | NOAA's 1-minute Kp estimate, shown as the headline Kp |
| `xray` | SWPC `json/goes/primary/xrays-1-day.json` | 60 s | 0.1–0.8 nm flux and the R-scale |
| `flares` | SWPC `json/goes/primary/xray-flares-7-day.json` | 5 min | SWPC's own flare list |
| `cme` | CCMC `DONKI-API/get/CME` (last 3 weeks) | 15 min | CME speed, direction, half-angle, `time21_5`, ENLIL arrival |
| `alerts` | SWPC `products/alerts.json` | 2 min | Alerts, warnings, watches |
| `ovation` | SWPC `json/ovation_aurora_latest.json` | 5 min | Aurora probability grid |
| `scales` | SWPC `products/noaa-scales.json` | 5 min | Current G/R/S and the 3-day outlook |

Three changes since version 1:
- The `plasma-7-day` and `mag-7-day` products were retired. They now return 404.
- The Kp product switched from arrays of strings to objects.
- DONKI moved from `api.nasa.gov` to `ccmc.gsfc.nasa.gov/DONKI-API` on 30 September 2026 and no longer needs a key.

Version 1 still pointed at all of the old endpoints.

## When a source fails

- **Failed requests are retried with backoff,** from 1 minute up to 10.
- **A feed that has never loaded** shows as unreachable in the status line, and its panel shows an empty state.
- **A feed that loaded before** keeps showing its last good copy, from memory or IndexedDB. Its status lamp turns amber.
- **Nothing is ever replaced with made-up data.**

## Archives (replays)

| Source | Access | Used for |
|---|---|---|
| OMNI HRO 1-min (NASA GSFC SPDF) | CDAWeb HAPI `OMNI_HRO_1MIN` | Solar wind at the bow shock, SYM-H |
| OMNI2 hourly | CDAWeb HAPI `OMNI2_H0_MRG1HR` | Kp model fit only (not shipped) |
| GFZ Potsdam Kp | `kp.gfz.de/app/json` | Definitive Kp, CC BY 4.0 |
| CCMC DONKI | `DONKI-API/get/CME`, `FLR`, `IPS` | CMEs, flares, shock arrivals (2010 and later) |
| SOHO/LASCO CDAW catalogue, GOES event list | entered by hand | Halloween 2003 CMEs and flares |

Rebuild everything with `npm run archive`, or a single event with `npx tsx scripts/fetch-archive.ts gannon-2024`.

## Attribution

Please keep these credits if you reuse the data:

- NOAA Space Weather Prediction Center
- NASA Community Coordinated Modeling Center, Space Weather Database Of Notifications, Knowledge, Information (DONKI)
- NASA GSFC Space Physics Data Facility, OMNIWeb (J.H. King, N. Papitashvili)
- GFZ German Research Centre for Geosciences, Kp index (Matzka et al. 2021), CC BY 4.0
