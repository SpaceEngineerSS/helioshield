import { useEffect } from 'react';
import { useStore } from './store';
import { ARCHIVE, loadArchive } from '../data/archive';

/**
 * Mirrors the view into the URL so a replay moment can be shared:
 *   ?event=gannon-2024&t=2024-05-10T18:30Z&lang=tr
 */
export function useUrlState(): void {
  // Read once on load.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const lang = q.get('lang');
    if (lang === 'en' || lang === 'tr') useStore.getState().setPrefs({ lang });
    const event = q.get('event');
    if (event && ARCHIVE.some((e) => e.id === event)) {
      const t = Date.parse(q.get('t') ?? '');
      void openReplay(event, Number.isFinite(t) ? t : undefined).catch(() => undefined);
    }
  }, []);

  // Write on change, without spamming history while playing.
  const replayId = useStore((s) => s.replay?.id ?? null);
  const cursor = useStore((s) => (s.playing ? null : s.cursor));
  const lang = useStore((s) => s.lang);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (replayId) q.set('event', replayId);
    else q.delete('event');
    if (replayId && cursor != null) q.set('t', new Date(cursor).toISOString().slice(0, 16) + 'Z');
    else q.delete('t');
    if (q.has('lang')) q.set('lang', lang);
    const s = q.toString();
    const next = `${location.pathname}${s ? `?${s}` : ''}${location.hash}`;
    if (next !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', next);
  }, [replayId, cursor, lang]);
}

let controller: AbortController | null = null;

export async function openReplay(id: string, at?: number): Promise<void> {
  const { setReplayLoading, setReplay } = useStore.getState();
  controller?.abort();
  controller = new AbortController();
  setReplayLoading(id);
  try {
    const event = await loadArchive(id, controller.signal);
    const cursor = at != null && at >= event.range[0] && at <= event.range[1] ? at : undefined;
    withTransition(() => setReplay(event, cursor));
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error(err);
      setReplayLoading(null);
      throw err;
    }
  }
}

export function closeReplay(): void {
  controller?.abort();
  withTransition(() => useStore.getState().setReplay(null));
}

/** Cross-fade big view changes where the browser supports it. */
export function withTransition(fn: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(fn);
  else fn();
}
