# Design

The look is an observatory instrument panel: the front of a magnetometer rack, or a page from a chart recorder. That choice drives everything else.

![Paper theme](assets/paper-tr.png)

## Principles

1. **Numbers first.** The largest thing in each panel is a measurement, set in IBM Plex Mono with tabular figures. Labels are small, uppercase and quiet.
2. **Colour means something.** There is one accent, solar amber `#E8A33D`, for the cursor, the live state and the Sun. The six-step level ramp, sage to amber to rust to crimson, is used only for NOAA scale levels. Southward Bz is rust and northward Bz is slate, because southward is the direction that matters. Anything HelioShield estimates itself is violet (`--model`), so it is never mistaken for an observation.
3. **Rules, not boxes.** Panels are separated by hairlines. A panel's corners carry registration marks, like a printed plate. There is no glass, no gradient fills, no glow and no emoji.
4. **Notes are written, not shouted.** Explanations and caveats are set in Newsreader italic, like an observer's note in the margin.
5. **Motion follows data.**
   - Readings tween when they change.
   - The Kp needle moves on a spring.
   - Panels settle in once on load.
   - Switching between live and replay cross-fades with the View Transitions API where the browser supports it.
   - Nothing moves just to look busy. With `prefers-reduced-motion`, nothing moves at all.

## Tokens

All tokens live in `src/styles/tokens.css` and come in two themes. **Night** is warm ink and the default. **Paper** is the same instrument printed on paper. The canvas code (charts, 3D scene, map) reads the same CSS variables, so a theme switch repaints everything.

| Token | Night | Paper | Use |
|---|---|---|---|
| `--bg` | `#0E0D0B` | `#ECE5D6` | page |
| `--surface` | `#14130F` | `#F4EFE4` | panels |
| `--text` | `#EDE6D8` | `#1C1915` | readings |
| `--text-2` | `#B8AE9C` | `#4A4338` | labels, 8:1+ |
| `--text-3` | `#8D8473` | `#6B6252` | meta, 4.8:1+ |
| `--sun` | `#E8A33D` | `#8F5508` | accent |
| `--model` | `#A99BD0` | `#5D4A9C` | our estimates |

Every text colour, including the level colours when they are used as text, passes WCAG AA (4.5:1) on its surface. Interface text is at least 12 px. Only chart axis ticks go down to 10–11 px.

## Type

- **IBM Plex Sans** for interface text.
- **IBM Plex Mono** for every number.
- **Newsreader Italic** for notes.

All three are self-hosted through Fontsource with Latin and Latin Extended subsets, so Turkish characters render without a network font request.

## The mark

A solar disc and the bow of the magnetopause: the two ends of what the app measures. One drawing (`src/ui/Logo.tsx`, `public/favicon.svg`) produces the favicon, the PWA icons, the maskable icon, the notification badge and the social card through `npm run icons`.

## Icons

The icons are drawn for this project on a 24-unit grid with the same 1.5 px stroke as the panel rules (`src/ui/icons.tsx`). Settings is a control knob rather than a gear, and Replay is a pair of tape reels.

## Accessibility

- Everything works from the keyboard. Space plays and pauses, the arrow keys step through time, and Shift with an arrow key steps by an hour.
- Focus rings are visible everywhere.
- Charts carry a text summary of range and latest value.
- Status changes are announced through a polite live region.
- The scrubber is a native range input with a readable time value.
- Touch targets are at least 44 px on touch screens.
