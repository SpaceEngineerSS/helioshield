import { describe, expect, it } from 'vitest';
import * as tx from './transform';
import wind from '../test/fixtures/rtsw-wind.json';
import mag from '../test/fixtures/rtsw-mag.json';
import kpForecast from '../test/fixtures/kp-forecast.json';
import kp1m from '../test/fixtures/kp-1m.json';
import xrays from '../test/fixtures/xrays.json';
import flaresRaw from '../test/fixtures/flares.json';
import cmeRaw from '../test/fixtures/donki-cme.json';
import alertsRaw from '../test/fixtures/alerts.json';
import scalesRaw from '../test/fixtures/scales.json';
import ovationRaw from '../test/fixtures/ovation.json';

describe('primitive parsers', () => {
  it('parses numbers leniently', () => {
    expect(tx.num(3)).toBe(3);
    expect(tx.num('4.5')).toBe(4.5);
    expect(tx.num('')).toBeNull();
    expect(tx.num(null)).toBeNull();
    expect(tx.num(Number.NaN)).toBeNull();
  });

  it('treats zone-less timestamps as UTC', () => {
    expect(tx.time('2026-10-13 14:31:37.343')).toBe(Date.UTC(2026, 9, 13, 14, 31, 37, 343));
    expect(tx.time('2026-10-13T16:58:00')).toBe(Date.UTC(2026, 9, 13, 16, 58));
    expect(tx.time('2026-09-13T01:24Z')).toBe(Date.UTC(2026, 8, 13, 1, 24));
    expect(tx.time('nope')).toBeNull();
  });
});

describe('solar wind (RTSW)', () => {
  const sw = tx.solarWind(wind, mag);

  it('merges plasma and field on a sorted minute grid', () => {
    expect(sw.t.length).toBeGreaterThan(10);
    for (let i = 1; i < sw.t.length; i++) expect(sw.t[i]).toBeGreaterThan(sw.t[i - 1]);
    expect(sw.t.every((t) => t % 60_000 === 0)).toBe(true);
    expect(sw.speed.some((v) => v != null && v > 200)).toBe(true);
    expect(sw.bz.some((v) => v != null)).toBe(true);
    expect(sw.spacecraft).toBeTruthy();
  });

  it('keeps only the operational (active) spacecraft', () => {
    const minutes = new Set(sw.t);
    expect(minutes.size).toBe(sw.t.length);
  });

  it('drops impossible values', () => {
    const bad = tx.solarWind([{ time_tag: '2026-01-01T00:00:00', active: true, proton_speed: -9999, proton_density: 1e6 }], []);
    expect(bad.speed[0]).toBeNull();
    expect(bad.density[0]).toBeNull();
  });
});

describe('Kp', () => {
  it('reads the forecast product with observed / estimated / predicted rows', () => {
    const kp = tx.kpSeries(kpForecast);
    expect(kp.t.length).toBeGreaterThan(20);
    expect(new Set(kp.kind)).toContain('observed');
    expect(new Set(kp.kind)).toContain('predicted');
    expect(kp.kp.every((k) => k >= 0 && k <= 9)).toBe(true);
  });

  it('drops the unreliable first minutes of each 3-hour period', () => {
    const now = tx.kpNowcast([
      { time_tag: '2026-10-13T17:59:00', estimated_kp: 2.33 },
      { time_tag: '2026-10-13T18:00:00', estimated_kp: 0 },
      { time_tag: '2026-10-13T18:07:00', estimated_kp: 0.33 },
      { time_tag: '2026-10-13T19:30:00', estimated_kp: 0 },
    ]);
    expect(now.kp).toEqual([2.33, 0]);
  });

  it('reads the 1-minute estimated Kp', () => {
    const now = tx.kpNowcast(kp1m);
    expect(now.t.length).toBeGreaterThan(0);
    expect(now.kp[0]).toBeGreaterThanOrEqual(0);
  });
});

describe('X-rays and flares', () => {
  it('keeps only the long channel', () => {
    const x = tx.xray(xrays);
    expect(x.t.length).toBe(20);
    expect(x.satellite).toBe(18);
  });

  it('reads the GOES flare list newest first', () => {
    const f = tx.flares(flaresRaw);
    expect(f.length).toBeGreaterThan(0);
    expect(f[0].cls).toMatch(/^[ABCMX]\d/);
    for (let i = 1; i < f.length; i++) expect(f[i].peak).toBeLessThanOrEqual(f[i - 1].peak);
  });
});

describe('DONKI CMEs', () => {
  const list = tx.cmes(cmeRaw);

  it('parses analyses and tolerates CMEs without one', () => {
    expect(list.length).toBeGreaterThanOrEqual(4);
    expect(list.every((c) => c.id && c.start > 0)).toBe(true);
    const bare = tx.cmes([{ activityID: 'x', startTime: '2026-01-01T00:00Z', cmeAnalyses: null }]);
    expect(bare[0].speed).toBeNull();
    expect(bare[0].enlil).toBeNull();
    expect(list.some((c) => c.t21 != null && c.halfAngle != null)).toBe(true);
  });

  it('extracts the latest ENLIL Earth arrival', () => {
    const withEnlil = list.filter((c) => c.enlil);
    expect(withEnlil.length).toBeGreaterThan(0);
    for (const c of withEnlil) expect(c.enlil!.arrival).toBeGreaterThan(c.start);
  });
});

describe('alerts, scales, ovation', () => {
  it('pulls a readable headline out of bulletin text', () => {
    const a = tx.alerts(alertsRaw);
    expect(a.length).toBe(6);
    expect(a[0].title).toMatch(/ALERT|WARNING|WATCH|SUMMARY/);
    expect(a[0].body).not.toMatch(/swpc\.noaa\.gov/);
    expect(['alert', 'warning', 'watch', 'summary', 'other']).toContain(a[0].kind);
  });

  it('reads current scales and the 3-day outlook', () => {
    const s = tx.scales(scalesRaw);
    expect(s.current.g).toBeGreaterThanOrEqual(0);
    expect(s.days.length).toBe(3);
  });

  it('builds a dense OVATION grid', () => {
    const o = tx.ovation(ovationRaw);
    expect(o.values.length).toBe(360 * 181);
    expect(o.forecast).toBeGreaterThan(o.observed);
  });
});
