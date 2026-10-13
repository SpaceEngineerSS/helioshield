import { describe, expect, it } from 'vitest';
import { clockAngle, dynamicPressure, newellCoupling } from './coupling';
import { estimateKp, formatKp, gScale, kpFromDrivers } from './kp';
import { DBM_DEFAULTS, dbmState, dbmTransitTime, estimateArrival } from './dbm';
import { angularSeparation, classifyImpact, solarB0 } from './cme-geometry';
import { magnetopauseRadius, shue1998 } from './magnetopause';
import { classToFlux, flareClass, rScale } from './scales';
import { auroraChance, geomagneticLatitude, ovationAt, ovationHorizon, viewLineLatitude } from './aurora';
import { nextDarkWindow, solarElevation, subsolarPoint } from './sun-position';
import { extent, indexAt, lastValid, lowerBound } from './series';
import { AU_KM, SOLAR_RADIUS_KM } from './constants';

describe('coupling', () => {
  it('clock angle runs from 0 (north) to π (south)', () => {
    expect(clockAngle(0, 5)).toBeCloseTo(0);
    expect(clockAngle(0, -5)).toBeCloseTo(Math.PI);
    expect(clockAngle(5, 0)).toBeCloseTo(Math.PI / 2);
    expect(clockAngle(-5, 0)).toBeCloseTo(Math.PI / 2);
  });

  it('Newell coupling vanishes for purely northward field and grows southward', () => {
    expect(newellCoupling(400, 0, 5)).toBeCloseTo(0, 6);
    const south = newellCoupling(400, 0, -5);
    expect(south).toBeGreaterThan(8000);
    expect(south).toBeLessThan(9000);
    expect(newellCoupling(800, 0, -5)).toBeGreaterThan(south * 2.4);
    expect(newellCoupling(0, 0, -5)).toBe(0);
  });

  it('dynamic pressure: 5 cm⁻³ at 400 km/s is about 1.3 nPa', () => {
    expect(dynamicPressure(5, 400)).toBeCloseTo(1.338, 2);
  });
});

describe('Kp model', () => {
  it('gives realistic values across regimes', () => {
    const quiet = kpFromDrivers(newellCoupling(350, 1, 2), (Math.sqrt(4) * 350 ** 2) / 1e6);
    const typical = kpFromDrivers(newellCoupling(400, 0, -5), (Math.sqrt(5) * 400 ** 2) / 1e6);
    const storm = kpFromDrivers(newellCoupling(750, 5, -25), (Math.sqrt(15) * 750 ** 2) / 1e6);
    expect(quiet).toBeLessThan(2);
    expect(typical).toBeGreaterThan(2);
    expect(typical).toBeLessThan(4);
    expect(storm).toBeGreaterThanOrEqual(7);
    expect(kpFromDrivers(1e9, 100)).toBe(9);
    expect(kpFromDrivers(0, 0)).toBe(0);
  });

  it('averages a window and refuses mostly-empty data', () => {
    const t = Array.from({ length: 180 }, (_, i) => i * 60_000);
    const v = t.map(() => 450);
    const n = t.map(() => 5);
    const by = t.map(() => 0);
    const bz = t.map(() => -8);
    const r = estimateKp(t, v, n, by, bz, 0, t[t.length - 1]);
    expect(r?.samples).toBe(180);
    expect(r!.kp).toBeGreaterThan(3);
    const sparse = bz.map((x, i) => (i % 10 === 0 ? x : null));
    expect(estimateKp(t, v, n, by, sparse, 0, t[t.length - 1])).toBeNull();
  });

  it('maps Kp to the G-scale the way SWPC does', () => {
    expect(gScale(4.33)).toBe(0);
    expect(gScale(4.67)).toBe(1);
    expect(gScale(6)).toBe(2);
    expect(gScale(7.67)).toBe(4);
    expect(gScale(8.67)).toBe(5);
    expect(gScale(9)).toBe(5);
  });

  it('formats Kp in thirds', () => {
    expect(formatKp(4.67)).toBe('5-');
    expect(formatKp(5)).toBe('5o');
    expect(formatKp(5.33)).toBe('5+');
    expect(formatKp(0)).toBe('0o');
  });
});

describe('drag-based model', () => {
  const p = { v0: 1200, w: 450, gamma: 0.1e-7, r0: DBM_DEFAULTS.r0 };

  it('closed form matches a direct numerical integration', () => {
    let r = p.r0;
    let v = p.v0;
    const dt = 10;
    for (let t = 0; t < 20 * 3600; t += dt) {
      const a = -p.gamma * (v - p.w) * Math.abs(v - p.w);
      r += v * dt + 0.5 * a * dt * dt;
      v += a * dt;
    }
    const exact = dbmState(p, 20 * 3600);
    expect(Math.abs(exact.v - v)).toBeLessThan(0.5);
    expect(Math.abs(exact.r - r) / r).toBeLessThan(1e-4);
  });

  it('relaxes toward the ambient wind from either side', () => {
    // γ = 1e-8 km⁻¹ is weak drag: a 1200 km/s CME is still well above ambient after 5 days.
    expect(dbmState(p, 5 * 86_400).v).toBeLessThan(700);
    expect(dbmState(p, 5 * 86_400).v).toBeGreaterThan(p.w);
    expect(dbmState({ ...p, v0: 300 }, 5 * 86_400).v).toBeGreaterThan(300);
  });

  it('faster CMEs arrive sooner, and the window brackets the central time', () => {
    const slow = dbmTransitTime({ ...p, v0: 600 })!;
    const fast = dbmTransitTime({ ...p, v0: 2000 })!;
    expect(fast).toBeLessThan(slow);
    const est = estimateArrival(0, 1500)!;
    expect(est.earliest).toBeLessThanOrEqual(est.arrival);
    expect(est.latest).toBeGreaterThanOrEqual(est.arrival);
    expect(est.transitHours).toBeGreaterThan(15);
    expect(est.transitHours).toBeLessThan(60);
    expect(dbmState({ ...p, v0: 1500 }, est.transitHours * 3600).r).toBeCloseTo(AU_KM, -4);
  });

  it('returns null for missing speed', () => {
    expect(estimateArrival(0, 0)).toBeNull();
    expect(dbmTransitTime({ ...p, r0: 2 * AU_KM })).toBe(0);
    expect(SOLAR_RADIUS_KM).toBeGreaterThan(0);
  });
});

describe('CME geometry', () => {
  it('B0 stays within ±7.25°', () => {
    for (let m = 0; m < 12; m++) {
      const b = solarB0(Date.UTC(2025, m, 15));
      expect(Math.abs(b)).toBeLessThanOrEqual(7.25);
    }
    expect(solarB0(Date.UTC(2025, 8, 7))).toBeGreaterThan(7);
  });

  it('measures great-circle separation', () => {
    expect(angularSeparation(0, 0, 0, 90)).toBeCloseTo(90);
    expect(angularSeparation(10, 0, -10, 0)).toBeCloseTo(20);
  });

  it('classifies direct, flank, miss and unknown', () => {
    const june = Date.UTC(2025, 5, 7); // B0 ≈ 0
    expect(classifyImpact(0, 5, 40, june).impact).toBe('direct');
    expect(classifyImpact(0, 38, 40, june).impact).toBe('flank');
    expect(classifyImpact(0, 80, 40, june).impact).toBe('miss');
    expect(classifyImpact(null, 10, 40, june).impact).toBe('unknown');
  });
});

describe('magnetopause', () => {
  it('reproduces the Shue et al. (1998) standoff', () => {
    const mp = shue1998(0, 2);
    expect(mp.r0).toBeCloseTo(10.25, 1);
    expect(magnetopauseRadius(mp, 0)).toBeCloseTo(mp.r0);
    expect(magnetopauseRadius(mp, Math.PI / 2)).toBeGreaterThan(mp.r0);
  });

  it('is compressed by pressure and southward Bz', () => {
    expect(shue1998(-20, 20).r0).toBeLessThan(7);
    expect(shue1998(5, 1).r0).toBeGreaterThan(shue1998(-5, 1).r0);
  });
});

describe('scales', () => {
  it('follows the NOAA R-scale thresholds', () => {
    expect(rScale(9e-6)).toBe(0);
    expect(rScale(1e-5)).toBe(1);
    expect(rScale(5e-5)).toBe(2);
    expect(rScale(1e-4)).toBe(3);
    expect(rScale(1e-3)).toBe(4);
    expect(rScale(2e-3)).toBe(5);
  });

  it('round-trips flare classes', () => {
    expect(flareClass(2.067e-6)).toBe('C2.0');
    expect(flareClass(9.3e-4)).toBe('X9.3');
    expect(classToFlux('M2.3')).toBeCloseTo(2.3e-5);
    expect(classToFlux('X17.2')).toBeCloseTo(1.72e-3);
    expect(classToFlux('?')).toBeNull();
  });
});

describe('aurora', () => {
  it('computes geomagnetic latitude', () => {
    expect(geomagneticLatitude(80.8, -72.8)).toBeCloseTo(90, 0);
    const oslo = geomagneticLatitude(59.91, 10.75);
    expect(oslo).toBeGreaterThan(55);
    expect(oslo).toBeLessThan(60);
  });

  it('reads the OVATION grid and the poleward horizon', () => {
    const values = new Array(360 * 181).fill(0);
    values[10 * 181 + (68 + 90)] = 60;
    const grid = { observed: 0, forecast: 0, values };
    expect(ovationAt(grid, 68, 10)).toBe(60);
    expect(ovationAt(grid, 68, 370)).toBe(60);
    expect(ovationHorizon(grid, 62, 10)).toBe(60);
    expect(ovationHorizon(grid, 50, 10)).toBe(0);
    expect(auroraChance(0, 60)).toBe('likely');
    expect(auroraChance(12, 0)).toBe('possible');
    expect(viewLineLatitude(9)).toBe(48);
  });
});

describe('sun position', () => {
  it('puts the sun high at local noon and below the horizon at midnight', () => {
    const noon = Date.UTC(2025, 2, 20, 12, 0);
    expect(solarElevation(noon, 0, 0)).toBeGreaterThan(85);
    expect(solarElevation(Date.UTC(2025, 2, 20, 0, 0), 0, 0)).toBeLessThan(-80);
    const [lat] = subsolarPoint(Date.UTC(2025, 5, 21, 12));
    expect(lat).toBeCloseTo(23.4, 0);
  });

  it('finds a dark window in winter and none at midsummer in the Arctic', () => {
    expect(nextDarkWindow(Date.UTC(2025, 11, 1, 12), 41, 29)).not.toBeNull();
    expect(nextDarkWindow(Date.UTC(2025, 5, 21, 0), 69.6, 19)).toBeNull();
  });
});

describe('series helpers', () => {
  const t = [10, 20, 30, 40];
  it('binary-searches sorted time arrays', () => {
    expect(lowerBound(t, 25)).toBe(2);
    expect(indexAt(t, 30)).toBe(2);
    expect(indexAt(t, 5)).toBe(-1);
  });
  it('skips nulls', () => {
    expect(lastValid([1, null, null], 2)).toEqual({ value: 1, index: 0 });
    expect(extent([null, 3, -2, null])).toEqual([-2, 3]);
    expect(extent([null])).toBeNull();
  });
});
