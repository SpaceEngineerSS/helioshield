import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ArchiveEvent } from '../data/archive';
import { snapshotAt, useBuildDataset, type Dataset } from './derive';
import { useStore } from './store';
import { HOUR_MS } from '../model/constants';

function load(id: string): ArchiveEvent {
  return JSON.parse(readFileSync(`public/archive/${id}.json`, 'utf8'));
}

function datasetFor(event: ArchiveEvent): Dataset {
  useStore.getState().setReplay(event);
  return renderHook(() => useBuildDataset()).result.current;
}

describe('replay dataset', () => {
  const gannon = datasetFor(load('gannon-2024'));

  it('is built from the archive', () => {
    expect(gannon.kind).toBe('replay');
    expect(gannon.shifted).toBe(true);
    expect(gannon.sw!.t.length).toBeGreaterThan(3000);
    expect(gannon.modelKp.t.length).toBeGreaterThan(100);
  });

  it('reads storm conditions at the main phase', () => {
    const s = snapshotAt(gannon, Date.parse('2024-05-11T02:00Z'));
    expect(s.kpOfficial).toBeGreaterThanOrEqual(8.5);
    expect(s.g).toBe(5);
    expect(s.symh).toBeLessThan(-250);
    expect(s.magnetopause!.r0).toBeLessThan(8);
  });

  it('tracks the model against definitive Kp within a reasonable error', () => {
    let se = 0;
    let n = 0;
    gannon.kp!.t.forEach((t0, i) => {
      const s = snapshotAt(gannon, t0 + 3 * HOUR_MS - 60_000);
      if (s.kpModel == null) return;
      se += (s.kpModel - gannon.kp!.kp[i]) ** 2;
      n++;
    });
    expect(n).toBeGreaterThan(10);
    // An extreme storm is the hardest case for a statistical fit; the full
    // 2020–2025 test set is at 0.69.
    expect(Math.sqrt(se / n)).toBeLessThan(1.6);
  });
});

describe('DBM against observed shock arrivals', () => {
  // CME first-seen time → shock arrival at Earth, from the archived events.
  const pairs: [string, string, string][] = [
    ['october-2024', '2024-10-09T02:12Z', '2024-10-10T14:46Z'],
    ['september-2017', '2017-09-04T20:36Z', '2017-09-06T23:08Z'],
    ['september-2017', '2017-09-06T12:24Z', '2017-09-07T22:30Z'],
    ['st-patricks-2015', '2015-03-15T02:00Z', '2015-03-17T04:05Z'],
    ['halloween-2003', '2003-10-28T11:30Z', '2003-10-29T06:11Z'],
    ['halloween-2003', '2003-10-29T20:54Z', '2003-10-30T16:19Z'],
    ['gannon-2024', '2024-05-08T05:36Z', '2024-05-10T16:36Z'],
  ];

  it('stays within the error typical of the method', () => {
    const errors = pairs.map(([id, start, observed]) => {
      const d = datasetFor(load(id));
      const track = d.cmes.find((c) => Math.abs(c.start - Date.parse(start)) < 60_000);
      expect(track?.dbm, `${id} ${start}`).toBeTruthy();
      const obs = Date.parse(observed);
      // The observed arrival should sit inside or near the ensemble window.
      expect(track!.dbm!.earliest - 6 * HOUR_MS).toBeLessThan(obs);
      expect(track!.dbm!.latest + 6 * HOUR_MS).toBeGreaterThan(obs);
      return Math.abs(track!.dbm!.arrival - obs) / HOUR_MS;
    });
    const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
    expect(mae).toBeLessThan(10);
  });
});
