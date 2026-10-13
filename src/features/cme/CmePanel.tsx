import { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { isEarthBound, useDataset, useSnapshot, type CmeTrack } from '../../state/derive';
import { useFormat, useT, type Format } from '../../i18n';
import type { Dict } from '../../i18n/en';
import { Panel } from '../../ui/Panel';
import { External } from '../../ui/icons';
import { frontPositionAu } from '../../model/dbm';
import './cme.css';

function heliographic(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return '—';
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'W' : 'E';
  return `${ns}${String(Math.round(Math.abs(lat))).padStart(2, '0')}${ew}${String(Math.round(Math.abs(lon))).padStart(2, '0')}`;
}

function CmeRow({ c, now, t, fmt }: { c: CmeTrack; now: number; t: Dict; fmt: Format }) {
  const au = c.speed ? frontPositionAu(c.launch, c.speed, now, c.ambient, c.r0) : null;
  const progress = au == null ? 0 : Math.min(1, Math.max(0, au));
  const target = c.dbm?.arrival ?? c.enlil?.arrival ?? null;

  return (
    <m.li
      className={`cme cme--${c.impact}`}
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="cme__head">
        <span className="cme__impact">{t.cme.impact[c.impact]}</span>
        {target != null && <span className="cme__eta num">{target > now ? fmt.relative(target, now) : t.cme.arrived}</span>}
      </div>
      <dl className="cme__facts">
        <div>
          <dt>{t.cme.launched}</dt>
          <dd className="num">{fmt.dateTime(c.start)}</dd>
        </div>
        <div>
          <dt>{t.cme.speed}</dt>
          <dd className="num">{c.speed ? `${fmt.num(c.speed)} km/s` : '—'}</dd>
        </div>
        <div>
          <dt>{t.cme.direction}</dt>
          <dd className="num" title={c.separation != null ? `${fmt.num(c.separation)}° from Earth` : undefined}>
            {heliographic(c.lat, c.lon)}
            {c.halfAngle != null && <span className="muted"> ±{fmt.num(c.halfAngle)}°</span>}
          </dd>
        </div>
      </dl>

      {c.dbm && (
        <>
          <div className="cme__track" aria-hidden="true">
            <span className="cme__track-fill" style={{ width: `${progress * 100}%` }} />
            <span className="cme__track-sun" />
            <span className="cme__track-earth" />
          </div>
          <div className="cme__arrivals">
            <p>
              <span className="label">{t.cme.model}</span>
              <span className="num cme__time">{fmt.dateTime(c.dbm.arrival)} UTC</span>
              <span className="cme__window num">{t.cme.window(fmt.dateTime(c.dbm.earliest), fmt.dateTime(c.dbm.latest))}</span>
            </p>
            <p>
              <span className="label">{t.cme.enlil}</span>
              {c.enlil ? (
                <>
                  <span className="num cme__time">{fmt.dateTime(c.enlil.arrival)} UTC</span>
                  <span className="cme__window">
                    {c.enlil.glancing && t.cme.glancing}
                    {c.enlil.kpHigh != null && <span className="num"> Kp {c.enlil.kpLow}–{c.enlil.kpHigh}</span>}
                  </span>
                </>
              ) : (
                <span className="muted">{t.cme.noEnlil}</span>
              )}
            </p>
          </div>
        </>
      )}
      {c.link && (
        <a className="cme__link" href={c.link} target="_blank" rel="noreferrer">
          {t.cme.open}
          <External />
        </a>
      )}
    </m.li>
  );
}

export function CmePanel() {
  const t = useT();
  const fmt = useFormat();
  const d = useDataset();
  const snap = useSnapshot();
  const [showMisses, setShowMisses] = useState(false);
  const now = snap.t;

  const launched = d.cmes.filter((c) => c.start <= now);
  const relevant = launched
    .filter(isEarthBound)
    .sort((a, b) => (a.dbm?.arrival ?? a.start) - (b.dbm?.arrival ?? b.start))
    .reverse();
  const misses = launched.filter((c) => !isEarthBound(c));
  const shown = showMisses ? [...relevant, ...misses] : relevant;

  return (
    <Panel index="04" title={t.cme.title} meta={d.kind === 'live' ? t.cme.meta : null} order={3}>
      {shown.length === 0 ? (
        <p className="empty">{t.cme.none}</p>
      ) : (
        <ul className="cmes">
          <AnimatePresence initial={false}>
            {shown.slice(0, 12).map((c) => (
              <CmeRow key={c.id} c={c} now={now} t={t} fmt={fmt} />
            ))}
          </AnimatePresence>
        </ul>
      )}
      <div className="cme__foot">
        {misses.length > 0 && d.kind === 'live' && (
          <button type="button" className="btn btn--ghost" onClick={() => setShowMisses((v) => !v)}>
            {showMisses ? t.cme.hideMisses : t.cme.showAll(misses.length)}
          </button>
        )}
        <p className="cme__explain note">{t.cme.explain}</p>
      </div>
    </Panel>
  );
}
