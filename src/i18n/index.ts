import { useMemo } from 'react';
import { useStore, type Lang } from '../state/store';
import { en, type Dict } from './en';
import { tr } from './tr';

const dicts: Record<Lang, Dict> = { en, tr };

export function useT(): Dict {
  return dicts[useStore((s) => s.lang)];
}

export function dictFor(lang: Lang): Dict {
  return dicts[lang];
}

export interface Format {
  lang: Lang;
  /** 14:02 */
  time: (ms: number) => string;
  /** 13 Oct 14:02 */
  dateTime: (ms: number) => string;
  /** 13 Oct */
  date: (ms: number) => string;
  /** 13 Oct 2024 */
  fullDate: (ms: number) => string;
  /** Mon 13 */
  weekday: (ms: number) => string;
  num: (v: number, digits?: number) => string;
  /** "12 min" / "3 h" */
  duration: (ms: number) => string;
  /** "12 min ago" / "in 3 h" */
  relative: (ms: number, now?: number) => string;
}

export function makeFormat(lang: Lang, t: Dict): Format {
  const locale = lang === 'tr' ? 'tr-TR' : 'en-GB';
  const tf = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
  const dtf = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  });
  const df = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const fdf = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const wf = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
  const nfs = new Map<number, Intl.NumberFormat>();
  const nf = (d: number) => {
    let f = nfs.get(d);
    if (!f) {
      f = new Intl.NumberFormat(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
      nfs.set(d, f);
    }
    return f;
  };
  const duration = (ms: number) => {
    const m = Math.round(Math.abs(ms) / 60_000);
    if (m < 90) return t.time.min(m);
    const h = Math.round(m / 60);
    if (h < 48) return t.time.h(h);
    return t.time.d(Math.round(h / 24));
  };
  return {
    lang,
    time: (ms) => tf.format(ms),
    dateTime: (ms) => dtf.format(ms),
    date: (ms) => df.format(ms),
    fullDate: (ms) => fdf.format(ms),
    weekday: (ms) => wf.format(ms),
    num: (v, d = 0) => nf(d).format(v),
    duration,
    relative: (ms, now = Date.now()) => {
      const diff = ms - now;
      if (Math.abs(diff) < 60_000) return t.time.now;
      return diff < 0 ? t.time.ago(duration(diff)) : t.time.in(duration(diff));
    },
  };
}

export function useFormat(): Format {
  const lang = useStore((s) => s.lang);
  return useMemo(() => makeFormat(lang, dicts[lang]), [lang]);
}
