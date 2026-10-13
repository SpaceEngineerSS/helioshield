import { useCallback } from 'react';
import { useStore } from '../../state/store';
import { useDataset, useSnapshot } from '../../state/derive';
import { useFormat, useT } from '../../i18n';
import { Panel } from '../../ui/Panel';
import { Readout } from '../../ui/Readout';
import { Ruler } from '../../ui/Ruler';
import { Level } from '../../ui/Level';
import { formatKp } from '../../model/kp';
import { magnetopauseRadius, GEO_ORBIT_RE } from '../../model/magnetopause';
import { flareClass } from '../../model/scales';
import './conditions.css';

export function Conditions() {
  const t = useT();
  const fmt = useFormat();
  const d = useDataset();
  const s = useSnapshot();
  const scales = useStore((st) => st.feeds.scales.data);
  const playing = useStore((st) => st.playing);
  const live = d.kind === 'live';

  const f0 = useCallback((v: number) => fmt.num(v, 0), [fmt]);
  const f1 = useCallback((v: number) => fmt.num(v, 1), [fmt]);
  const fKp = useCallback((v: number) => fmt.num(v, 2), [fmt]);

  // Live: the official NOAA scales. Replay: derived from the archived Kp and flares.
  const g = live && scales && d.range[1] === s.t ? scales.current.g : s.g;
  const r = live && scales && d.range[1] === s.t ? scales.current.r : s.r;
  const sLevel = live && scales ? scales.current.s : null;

  const kpSource =
    s.kpOfficialKind === 'nowcast'
      ? t.readouts.kpNowcast
      : s.kpOfficialKind === 'estimated'
        ? t.readouts.kpEstimated
        : s.kpOfficialKind === 'predicted'
          ? t.readouts.kpPredicted
          : live
            ? t.readouts.kpObserved
            : t.readouts.kpDefinitive;

  const standoff = s.magnetopause ? magnetopauseRadius(s.magnetopause, 0) : null;

  return (
    <Panel
      index="01"
      title={live ? t.conditions.title : t.conditions.titleReplay}
      meta={<span className="num">{fmt.dateTime(s.t)} UTC</span>}
      order={0}
      flush
    >
      <div className="cond">
        <div className="cond__kp">
          <div className="cond__kp-top">
            <Readout
              hero
              label={t.readouts.kp}
              value={s.kpOfficial}
              format={fKp}
              empty={t.readouts.noData}
              instant={playing}
              sub={
                <>
                  {s.kpOfficial != null && <span className="num cond__thirds">{formatKp(s.kpOfficial)}</span>}
                  {kpSource}
                  {s.kpModel != null && (
                    <>
                      {' · '}
                      <span className="cond__model">{t.readouts.kpModel(fmt.num(s.kpModel, 1))}</span>
                    </>
                  )}
                </>
              }
            />
            <div className="cond__scales">
              <div className="cond__scale">
                <span className="label">{t.scales.g}</span>
                <Level letter="G" n={g} name={t.scales.level(g)} />
              </div>
              <div className="cond__scale">
                <span className="label">{t.scales.r}</span>
                <Level letter="R" n={r} name={t.scales.level(r)} />
              </div>
              {sLevel != null && (
                <div className="cond__scale">
                  <span className="label">{t.scales.s}</span>
                  <Level letter="S" n={sLevel} name={t.scales.level(sLevel)} />
                </div>
              )}
            </div>
          </div>
          <Ruler value={s.kpOfficial} ghost={s.kpModel} label={`${t.readouts.kp} ${s.kpOfficial ?? '—'}`} />
        </div>

        <div className="cond__cells">
          <div className="cond__cell">
            <Readout label={t.readouts.speed} value={s.speed} format={f0} unit="km/s" empty={t.readouts.noData} instant={playing} />
          </div>
          <div className="cond__cell">
            <Readout label={t.readouts.density} value={s.density} format={f1} unit="p/cm³" empty={t.readouts.noData} instant={playing} />
          </div>
          <div className="cond__cell">
            <Readout
              label={t.readouts.bz}
              value={s.bz}
              format={f1}
              unit="nT"
              empty={t.readouts.noData}
              instant={playing}
              color={s.bz == null ? undefined : s.bz < 0 ? 'var(--south)' : 'var(--north)'}
              sub={s.bz == null ? null : s.bz < 0 ? t.readouts.southward : t.readouts.northward}
            />
          </div>
          <div className="cond__cell">
            <Readout label={t.readouts.bt} value={s.bt} format={f1} unit="nT" empty={t.readouts.noData} instant={playing} />
          </div>
          <div className="cond__cell">
            <Readout
              label={t.readouts.magnetopause}
              value={standoff}
              format={f1}
              unit="Rₑ"
              empty={t.readouts.noData}
              instant={playing}
              color={standoff != null && standoff < GEO_ORBIT_RE ? 'var(--lv4)' : undefined}
              sub={standoff != null && standoff < GEO_ORBIT_RE ? t.readouts.insideGeo : t.readouts.standoff}
            />
          </div>
          {live ? (
            <div className="cond__cell">
              <Readout
                label={t.charts.xray}
                value={s.xrayFlux}
                format={(v) => flareClass(v)}
                empty={t.readouts.noData}
                instant
                sub={s.xrayFlux != null ? `${s.xrayFlux.toExponential(1)} W/m²` : null}
              />
            </div>
          ) : (
            <div className="cond__cell">
              <Readout
                label={t.readouts.symh}
                value={s.symh}
                format={f0}
                unit="nT"
                empty={t.readouts.noData}
                instant={playing}
                color={s.symh != null && s.symh < -100 ? 'var(--lv4)' : undefined}
                sub={t.readouts.symhNote}
              />
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
