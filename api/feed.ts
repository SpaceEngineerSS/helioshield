/**
 * GET /api/feed?id=<feed>
 *
 * Fetches one feed from NOAA / NASA, trims it to the fields the app uses, and
 * lets Vercel's CDN cache the result. A single cached response serves every
 * visitor, so upstreams see one request per TTL instead of one per browser,
 * and clients download a small fraction of the raw payloads (the raw solar
 * wind products alone are ~4 MB per minute).
 */

import { SOURCES, buildFeed, isFeedId } from '../src/data/sources';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id');
  if (!isFeedId(id)) {
    return json({ error: 'unknown feed' }, 404, 'public, max-age=3600');
  }

  const ttl = SOURCES[id].ttl;
  try {
    const data = await buildFeed(id, fetch, AbortSignal.timeout(15_000));
    return json(
      { id, fetchedAt: Date.now(), data },
      200,
      `public, max-age=${Math.min(ttl, 60)}, s-maxage=${ttl}, stale-while-revalidate=${ttl * 10}`,
    );
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'upstream failed' }, 502, 'no-store');
  }
}

function json(body: unknown, status: number, cache: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache,
      'access-control-allow-origin': '*',
    },
  });
}
