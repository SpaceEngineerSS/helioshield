/// <reference lib="webworker" />
/**
 * Fetches feeds off the main thread. Tries the cached edge feed first; when
 * that is unavailable (local preview, edge outage) it goes to the upstream
 * directly and runs the same transform here, so a 4 MB JSON parse never
 * blocks the UI.
 */

import { buildFeed } from './sources';
import type { FeedId, FeedMap } from './types';

export type WorkerRequest = { seq: number; id: FeedId };
export type WorkerResponse =
  | { seq: number; id: FeedId; ok: true; data: FeedMap[FeedId]; fetchedAt: number; via: 'edge' | 'direct' }
  | { seq: number; id: FeedId; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

async function viaEdge(id: FeedId): Promise<{ data: FeedMap[FeedId]; fetchedAt: number } | null> {
  try {
    const res = await fetch(`/api/feed?id=${id}`, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return null;
    const body = await res.json();
    return body && body.data ? { data: body.data, fetchedAt: body.fetchedAt ?? Date.now() } : null;
  } catch {
    return null;
  }
}

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { seq, id } = e.data;
  const edge = await viaEdge(id);
  if (edge) {
    ctx.postMessage({ seq, id, ok: true, ...edge, via: 'edge' } satisfies WorkerResponse);
    return;
  }
  try {
    const data = await buildFeed(id, fetch, AbortSignal.timeout(20_000));
    ctx.postMessage({ seq, id, ok: true, data, fetchedAt: Date.now(), via: 'direct' } satisfies WorkerResponse);
  } catch (err) {
    ctx.postMessage({ seq, id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies WorkerResponse);
  }
};
