import type { Quality } from '../../state/store';

export type Tier = 'low' | 'medium' | 'high';

export interface TierSpec {
  particles: number;
  dpr: [number, number];
  antialias: boolean;
  fps: number;
  granulation: boolean;
}

export const TIERS: Record<Tier, TierSpec> = {
  low: { particles: 500, dpr: [1, 1], antialias: false, fps: 30, granulation: false },
  medium: { particles: 1200, dpr: [1, 1.5], antialias: true, fps: 45, granulation: false },
  high: { particles: 2400, dpr: [1, 2], antialias: true, fps: 60, granulation: true },
};

/** Starting tier for "auto", from what the browser tells us about the device. */
export function initialTier(pref: Quality): Tier {
  if (pref !== 'auto') return pref;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const small = Math.min(screen.width, screen.height) < 600;
  if (nav.connection?.saveData || mem <= 2 || cores <= 2) return 'low';
  if (small || mem <= 4 || cores <= 4) return 'low';
  if (mem >= 8 && cores >= 8 && devicePixelRatio <= 2) return 'high';
  return 'medium';
}

export function lowerTier(t: Tier): Tier {
  return t === 'high' ? 'medium' : 'low';
}

let webgl: boolean | null = null;
export function hasWebGL(): boolean {
  if (webgl != null) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  return webgl;
}
