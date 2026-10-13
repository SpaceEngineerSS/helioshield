/**
 * Keeps each live feed fresh on its own schedule.
 *
 * - One worker does all fetching and parsing.
 * - Polling pauses while the tab is hidden and catches up when it returns.
 * - A slow or failed request never overlaps the next one for the same feed.
 * - Failures back off (1, 2, 4 … 10 min) instead of hammering upstream.
 */

import { FEED_IDS, SOURCES } from './sources';
import type { FeedId } from './types';
import type { WorkerRequest, WorkerResponse } from './feed.worker';
import { useStore } from '../state/store';
import { loadAll, save } from './persist';

const MAX_BACKOFF = 10 * 60_000;
const REFRESH_EVENT = 'helioshield:refresh';

export function startPolling(): () => void {
  const worker = new Worker(new URL('./feed.worker.ts', import.meta.url), { type: 'module' });
  const timers = new Map<FeedId, ReturnType<typeof setTimeout>>();
  const inFlight = new Set<FeedId>();
  const failures = new Map<FeedId, number>();
  let seq = 0;
  let stopped = false;
  const { setFeed } = useStore.getState();

  const schedule = (id: FeedId, delay: number) => {
    clearTimeout(timers.get(id));
    if (stopped) return;
    timers.set(id, setTimeout(() => request(id), delay));
  };

  const request = (id: FeedId) => {
    if (stopped || inFlight.has(id)) return;
    if (document.visibilityState === 'hidden') return; // resumed by visibilitychange
    inFlight.add(id);
    worker.postMessage({ seq: ++seq, id } satisfies WorkerRequest);
  };

  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    inFlight.delete(msg.id);
    if (msg.ok) {
      failures.delete(msg.id);
      setFeed(msg.id, { data: msg.data as never, fetchedAt: msg.fetchedAt, error: null, pending: false, restored: false });
      void save(msg.id, msg.data as never, msg.fetchedAt);
      schedule(msg.id, SOURCES[msg.id].ttl * 1000);
    } else {
      const n = (failures.get(msg.id) ?? 0) + 1;
      failures.set(msg.id, n);
      setFeed(msg.id, { error: msg.error, pending: false });
      schedule(msg.id, Math.min(MAX_BACKOFF, 60_000 * 2 ** (n - 1)));
    }
  };

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    const feeds = useStore.getState().feeds;
    for (const id of FEED_IDS) {
      const at = feeds[id].fetchedAt ?? 0;
      if (Date.now() - at > SOURCES[id].ttl * 1000) request(id);
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  const onRefresh = () => FEED_IDS.forEach(request);
  window.addEventListener(REFRESH_EVENT, onRefresh);

  // Paint the stored copy first, then refresh everything from the network.
  void loadAll().then((stored) => {
    for (const s of stored) {
      const slot = useStore.getState().feeds[s.id];
      if (slot && slot.fetchedAt == null) {
        setFeed(s.id, { data: s.data as never, fetchedAt: s.fetchedAt, pending: false, restored: true });
      }
    }
  });
  FEED_IDS.forEach((id, i) => schedule(id, i * 40));

  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener(REFRESH_EVENT, onRefresh);
    worker.terminate();
  };
}

/** Manual refresh: re-request every feed now. */
export function refreshAll(): void {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}
