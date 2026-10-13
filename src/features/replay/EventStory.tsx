import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { useDataset } from '../../state/derive';
import { useFormat, useT } from '../../i18n';
import { Panel } from '../../ui/Panel';
import { ARCHIVE } from '../../data/archive';
import { extent, indexAt } from '../../model/series';
import { formatKp } from '../../model/kp';
import { HOUR_MS } from '../../model/constants';
import { closeReplay } from '../../state/url';
import './replay.css';

export function EventStory() {
  const t = useT();
  const fmt = useFormat();
  const d = useDataset();
  const replay = useStore((s) => s.replay);
  const entry = ARCHIVE.find((e) => e.id === replay?.id);
  const ev = entry ? t.events[entry.key as keyof typeof t.events] : null;

  const facts = useMemo(() => {
    const kp = d.kp;
    const peakKp = kp && kp.kp.length ? Math.max(...kp.kp) : null;
    const symh = d.symh ? extent(d.symh.v)?.[0] ?? null : null;
    const speed = d.sw ? extent(d.sw.speed)?.[1] ?? null : null;
    const bz = d.sw ? extent(d.sw.bz)?.[0] ?? null : null;

    // Our model against the definitive Kp, interval by interval.
    let se = 0;
    let n = 0;
    if (kp) {
      kp.t.forEach((t0, i) => {
        // Model value at the end of the 3-hour interval covers that interval.
        const j = indexAt(d.modelKp.t, t0 + 3 * HOUR_MS);
        const m = j >= 0 ? d.modelKp.kp[j] : null;
        if (m == null || d.modelKp.t[j] < t0 + 2 * HOUR_MS) return;
        se += (m - kp.kp[i]) ** 2;
        n++;
      });
    }
    return { peakKp, symh, speed, bz, rmse: n ? Math.sqrt(se / n) : null, n };
  }, [d]);

  if (!replay || !ev) return null;

  return (
    <Panel index="05" title={ev.name} meta={ev.when} order={4}>
      <div className="story">
        <p className="story__text">{ev.story}</p>

        <section aria-label={t.replay.facts} className="story__facts">
          <h3 className="label">{t.replay.facts}</h3>
          <dl>
            <div>
              <dt>{t.replay.peakKp}</dt>
              <dd className="num">{facts.peakKp != null ? formatKp(facts.peakKp) : '—'}</dd>
            </div>
            <div>
              <dt>{t.replay.minSymh}</dt>
              <dd className="num">{facts.symh != null ? `${fmt.num(facts.symh)} nT` : '—'}</dd>
            </div>
            <div>
              <dt>{t.replay.maxSpeed}</dt>
              <dd className="num">{facts.speed != null ? `${fmt.num(facts.speed)} km/s` : '—'}</dd>
            </div>
            <div>
              <dt>{t.replay.minBz}</dt>
              <dd className="num">{facts.bz != null ? `${fmt.num(facts.bz, 1)} nT` : '—'}</dd>
            </div>
          </dl>
          {facts.rmse != null && (
            <p className="story__skill">
              <span className="label">{t.replay.modelSkill}</span>{' '}
              <span className="num">{t.replay.modelSkillValue(fmt.num(facts.rmse, 2), facts.n)}</span>
            </p>
          )}
        </section>

        <footer className="story__sources">
          <span className="label">{t.replay.sources}</span>
          <ul>
            {replay.sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <button type="button" className="btn" onClick={closeReplay}>
            {t.replay.exit}
          </button>
        </footer>
      </div>
    </Panel>
  );
}
