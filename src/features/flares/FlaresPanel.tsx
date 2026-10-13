import { useState } from 'react';
import { useDataset, useSnapshot } from '../../state/derive';
import { useFormat, useT } from '../../i18n';
import { Panel } from '../../ui/Panel';
import { levelColor } from '../../ui/level-color';
import { rScale } from '../../model/scales';
import './flares.css';

const COLLAPSED = 8;

export function FlaresPanel() {
  const t = useT();
  const fmt = useFormat();
  const d = useDataset();
  const snap = useSnapshot();
  const [all, setAll] = useState(false);

  // Live: everything C1+ from the GOES list. Replay: M1+ before the cursor.
  const minFlux = d.kind === 'live' ? 1e-6 : 1e-5;
  const flares = d.flares.filter((f) => f.flux >= minFlux && f.peak <= snap.t);
  const shown = all ? flares : flares.slice(0, COLLAPSED);
  // Log-scale bar from B5 to X10.
  const width = (flux: number) => `${Math.max(3, Math.min(100, ((Math.log10(flux) + 6.3) / 3.3) * 100))}%`;

  return (
    <Panel index="06" title={t.flares.title} meta={d.kind === 'live' ? t.flares.meta : t.flares.metaReplay} order={5}>
      {flares.length === 0 ? (
        <p className="empty">{t.flares.none}</p>
      ) : (
        <table className="table flares">
          <thead>
            <tr>
              <th scope="col">{t.flares.cls}</th>
              <th scope="col">{t.flares.peak}</th>
              <th scope="col" className="flares__bar-col">
                <span className="sr-only">{t.flares.cls}</span>
              </th>
              <th scope="col">{t.flares.duration}</th>
              <th scope="col">{t.flares.radio}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => {
              const r = rScale(f.flux);
              return (
                <tr key={`${f.peak}${f.cls}`}>
                  <td className="num flares__cls" style={{ color: f.flux >= 1e-5 ? levelColor(Math.max(2, r + 1)) : undefined }}>
                    {f.cls}
                  </td>
                  <td className="num">
                    {fmt.dateTime(f.peak)}
                    {f.location && <span className="muted"> {f.location}</span>}
                  </td>
                  <td className="flares__bar-col" aria-hidden="true">
                    <span className="flares__bar" style={{ width: width(f.flux), background: f.flux >= 1e-5 ? 'var(--sun)' : 'var(--text-3)' }} />
                  </td>
                  <td className="num muted">{f.end ? fmt.duration(f.end - f.begin) : '—'}</td>
                  <td className="num">{r > 0 ? `R${r}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {flares.length > COLLAPSED && (
        <button type="button" className="btn btn--ghost flares__more" onClick={() => setAll((v) => !v)}>
          {all ? t.flares.showFewer : t.flares.showAll(flares.length)}
        </button>
      )}
    </Panel>
  );
}
