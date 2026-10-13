# Contributing

Thanks for taking a look. Bug reports, data-source fixes and model improvements are all welcome.

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # types, lint, tests, build — CI runs the same
npm run smoke      # optional: drives the production build in Chrome
```

Node 20.19 or newer. No API keys.

## Ground rules

- **Never show invented data as real.** If a source is down, the panel says so. Synthetic or estimated values must be visibly marked. In the UI they use the `--model` colour.
- **Every model change comes with numbers.** If you touch `src/model/`, update [docs/validation.md](docs/validation.md) with before/after results, and keep the checks in `src/state/derive.test.ts` passing. `npm run fit:kp` and `npx tsx scripts/figures.ts` regenerate the Kp fit and the figures.
- **Parsers must stay tolerant.** A new upstream field or a `null` should skip a row, not break a feed. Add a trimmed real payload to `src/test/fixtures` when you change a parser.
- **Both languages.** Every user-facing string lives in `src/i18n/en.ts` and `src/i18n/tr.ts`. The Turkish file is type-checked against the English one, so a missing key fails the build.
- **Keep it light.** New dependencies need a reason. Anything heavy should load lazily, like three.js and the map.

## Pull requests

Keep them focused on one change. In the description, say what changed and how you checked it. Screenshots help for anything visual; `npm run screenshots` takes them for you with a dev server running.

## Updating the replay archives

`npm run archive` re-downloads all events. Add a new event in two places: `ARCHIVE` in `src/data/archive.ts` and the `events` section of both i18n files. Then run `npx tsx scripts/fetch-archive.ts <id>`.
