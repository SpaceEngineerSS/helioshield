# Security

HelioShield has no accounts, no backend database and no secrets. The only server code is `api/feed.ts`, which fetches from a fixed list of NOAA and NASA URLs.

If you find a problem, such as a way to make the edge function fetch something it should not, a CSP gap, or a dependency issue, please report it privately through [GitHub's security advisories](https://github.com/SpaceEngineerSS/helioshield/security/advisories/new) instead of opening a public issue. I'll reply within a few days.

Location is used only in the browser to read the aurora grid. It is rounded to about 1 km and stored in `localStorage` on your device. It is never sent anywhere.
