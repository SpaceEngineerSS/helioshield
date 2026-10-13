/**
 * Last good copy of every feed, kept in IndexedDB so a reload paints real
 * (if slightly old) data immediately and the app still opens offline.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { FeedId, FeedMap } from './types';

interface Stored {
  id: FeedId;
  fetchedAt: number;
  data: FeedMap[FeedId];
}

let db: Promise<IDBPDatabase> | null = null;

function open(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === 'undefined') return null;
  db ??= openDB('helioshield', 1, {
    upgrade(d) {
      d.createObjectStore('feeds', { keyPath: 'id' });
    },
  });
  return db;
}

export async function loadAll(): Promise<Stored[]> {
  try {
    const d = await open();
    return d ? ((await d.getAll('feeds')) as Stored[]) : [];
  } catch {
    return [];
  }
}

export async function save<K extends FeedId>(id: K, data: FeedMap[K], fetchedAt: number): Promise<void> {
  try {
    const d = await open();
    await d?.put('feeds', { id, data, fetchedAt } satisfies Stored);
  } catch {
    /* storage full or blocked; the live copy is still in memory */
  }
}
