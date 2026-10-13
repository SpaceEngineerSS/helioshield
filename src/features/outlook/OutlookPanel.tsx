import { useStore } from '../../state/store';
import { useFormat, useT } from '../../i18n';
import { Panel } from '../../ui/Panel';
import { levelColor } from '../../ui/level-color';
import { gScale } from '../../model/kp';
import { DAY_MS } from '../../model/constants';
import './outlook.css';

export function OutlookPanel() {
  const t = useT();
  const fmt = useFormat();
  const kp = useStore((s) => s.feeds.kp.data);
  const scales = useStore((s) => s.feeds.scales.data);

  const blocks: { t: number; kp: number; kind: string }[] = [];
  if (kp) {
    const first = kp.kind.findIndex((k) => k !== 'observed');
    for (let i = Math.max(0, first); i < kp.t.length && first >= 0; i++) blocks.push({ t: kp.t[i], kp: kp.kp[i], kind: kp.kind[i] });
  }
  const days = new Map<number, typeof blocks>();
  for (const b of blocks) {
    const day = Math.floor(b.t / DAY_MS) * DAY_MS;
    days.set(day, [...(days.get(day) ?? []), b]);
  }

  return (
    <Panel index="08" title={t.outlook.title} meta={t.outlook.meta} order={7}>
      <p className="label outlook__caption">{t.outlook.kp}</p>
      <div className="outlook__days">
        {[...days.entries()].slice(0, 4).map(([day, list]) => {
          const max = Math.max(...list.map((b) => b.kp));
          return (
            <div key={day} className="outlook__day">
              <div className="outlook__bars" role="img" aria-label={`${fmt.weekday(day)}: Kp max ${fmt.num(max, 1)}`}>
                {list.map((b) => (
                  <span
                    key={b.t}
                    className={`outlook__bar outlook__bar--${b.kind}`}
                    style={{ height: `${(b.kp / 9) * 100}%`, ['--c' as string]: levelColor(gScale(b.kp)) }}
                    title={`${fmt.time(b.t)} UTC · Kp ${fmt.num(b.kp, 2)}`}
                  />
                ))}
              </div>
              <div className="outlook__daylabel">
                <span className="num">{fmt.weekday(day)}</span>
                <span className="num muted">{fmt.num(max, 1)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {scales && scales.days.length > 0 && (
        <table className="table outlook__table">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">{t.outlook.maxG}</th>
              <th scope="col">{t.outlook.radio}</th>
              <th scope="col">{t.outlook.radioMajor}</th>
              <th scope="col">{t.outlook.proton}</th>
            </tr>
          </thead>
          <tbody>
            {scales.days.map((d) => (
              <tr key={d.date}>
                <th scope="row" className="num">
                  {fmt.weekday(Date.parse(`${d.date}T12:00Z`))}
                </th>
                <td className="num" style={{ color: d.g ? levelColor(d.g) : undefined }}>
                  {d.g ? `G${d.g}` : '—'}
                </td>
                <td className="num">{d.rMinorProb != null ? `${d.rMinorProb}%` : '—'}</td>
                <td className="num">{d.rMajorProb != null ? `${d.rMajorProb}%` : '—'}</td>
                <td className="num">{d.sProb != null ? `${d.sProb}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
