import { useEffect } from 'react';
import { useStore } from './store';
import type { Dataset } from './derive';

/** Real seconds it takes to play the whole window at 1×. */
export const WINDOW_SECONDS = 60;
/** Store updates per second while playing. The scene interpolates between them. */
const UPDATE_HZ = 24;

/**
 * Drives the cursor while playing. Time advances by a fraction of the window
 * per real second, so a 24 h live window and a 3-day replay both take about a
 * minute at 1×. Updates are throttled so React renders ~24 times a second
 * instead of once per animation frame.
 */
export function usePlaybackDriver(d: Dataset): void {
  const playing = useStore((s) => s.playing);

  useEffect(() => {
    if (!playing) return;
    const [start, end] = d.range;
    const span = end - start;
    if (span <= 0) return;

    let raf = 0;
    let last = performance.now();
    let lastPush = 0;
    let t = useStore.getState().cursor ?? start;
    if (t >= end) t = start;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { rate, setCursor, setPlaying } = useStore.getState();
      t += (span / WINDOW_SECONDS) * rate * dt;
      if (t >= end) {
        setCursor(d.kind === 'live' ? null : end);
        setPlaying(false);
        return;
      }
      if (now - lastPush > 1000 / UPDATE_HZ) {
        lastPush = now;
        setCursor(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, d.range, d.kind]);
}

/** Step the cursor by `ms`, clamped to the dataset window. */
export function stepCursor(d: Dataset, ms: number): void {
  const { cursor, setCursor, setPlaying } = useStore.getState();
  setPlaying(false);
  const next = Math.min(d.range[1], Math.max(d.range[0], (cursor ?? d.range[1]) + ms));
  setCursor(d.kind === 'live' && next >= d.range[1] ? null : next);
}
