import { useMemo, useState } from 'react';
import { useStore, type Place } from '../../state/store';
import { useFormat, useT } from '../../i18n';
import { Panel } from '../../ui/Panel';
import { Locate } from '../../ui/icons';
import { useNow } from '../../ui/hooks';
import { auroraChance, geomagneticLatitude, ovationAt, ovationHorizon, viewLineLatitude } from '../../model/aurora';
import { nextDarkWindow, solarElevation } from '../../model/sun-position';
import { formatKp } from '../../model/kp';
import { AuroraMap } from './AuroraMap';
import { CITIES } from './cities';
import './aurora.css';

function PlacePicker({ onPick }: { onPick: (p: Place) => void }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'busy' | 'denied'>('idle');

  const locate = () => {
    if (!navigator.geolocation) return setState('denied');
    setState('busy');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState('idle');
        // Two decimals (~1 km) is plenty, and nothing more precise is stored.
        onPick({
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lon: Math.round(pos.coords.longitude * 100) / 100,
          label: `${pos.coords.latitude.toFixed(1)}°, ${pos.coords.longitude.toFixed(1)}°`,
        });
      },
      () => setState('denied'),
      { maximumAge: 3_600_000, timeout: 10_000 },
    );
  };

  return (
    <div className="place">
      <button type="button" className="btn" onClick={locate} disabled={state === 'busy'}>
        <Locate />
        {state === 'busy' ? t.aurora.locating : t.aurora.useLocation}
      </button>
      <label className="place__city">
        <span className="sr-only">{t.aurora.city}</span>
        <select
          defaultValue=""
          onChange={(e) => {
            const c = CITIES.find((x) => x.name === e.target.value);
            if (c) onPick({ lat: c.lat, lon: c.lon, label: c.name });
          }}
        >
          <option value="" disabled>
            {t.aurora.pickCity}
          </option>
          {CITIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {state === 'denied' && <p className="place__denied">{t.aurora.denied}</p>}
    </div>
  );
}

export default function AuroraPanel() {
  const t = useT();
  const fmt = useFormat();
  const ovation = useStore((s) => s.feeds.ovation.data);
  const kp = useStore((s) => s.feeds.kp.data);
  const place = useStore((s) => s.place);
  const theme = useStore((s) => s.theme);
  const setPrefs = useStore((s) => s.setPrefs);
  const [editing, setEditing] = useState(false);
  const now = useNow(5 * 60_000);

  const view = useMemo(() => {
    if (!place) return null;
    const overhead = ovation ? ovationAt(ovation, place.lat, place.lon) : 0;
    const horizon = ovation ? ovationHorizon(ovation, place.lat, place.lon) : 0;
    const dark = solarElevation(now, place.lat, place.lon) <= -12;
    const darkWin = nextDarkWindow(now, place.lat, place.lon);
    const mlat = geomagneticLatitude(place.lat, place.lon);

    // Highest NOAA forecast Kp during the coming dark hours.
    let peak: number | null = null;
    if (kp && darkWin) {
      for (let i = 0; i < kp.t.length; i++) {
        const t0 = kp.t[i];
        if (t0 + 3 * 3_600_000 >= darkWin.start && t0 <= darkWin.end && kp.kind[i] !== 'observed') {
          peak = Math.max(peak ?? 0, kp.kp[i]);
        }
      }
    }
    return { overhead, horizon, chance: auroraChance(overhead, horizon), dark, window: darkWin, mlat, peak };
  }, [place, ovation, kp, now]);

  const viewLat = view?.peak != null ? viewLineLatitude(view.peak) : null;
  const verdict = view ? (view.chance === 'likely' ? t.aurora.likely : view.chance === 'possible' ? t.aurora.possible : t.aurora.unlikely) : null;

  return (
    <Panel
      index="05"
      title={t.aurora.title}
      meta={ovation ? t.aurora.meta(`${fmt.time(ovation.forecast)} UTC`) : null}
      order={4}
    >
      <div className="aurora">
        <AuroraMap ovation={ovation} place={place} viewLat={viewLat} label={t.aurora.mapLabel} theme={theme} />

        <div className="aurora__side">
          {!place || editing ? (
            <>
              <p className="label">{t.aurora.where}</p>
              <PlacePicker
                onPick={(p) => {
                  setPrefs({ place: p });
                  setEditing(false);
                }}
              />
            </>
          ) : (
            <>
              <div className="aurora__place">
                <span className="aurora__place-name">{place.label}</span>
                <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
                  {t.aurora.change}
                </button>
              </div>
              {view && (
                <>
                  <p className={`aurora__verdict aurora__verdict--${view.chance}`} aria-live="polite">
                    {verdict}
                  </p>
                  {!view.dark && view.chance !== 'unlikely' && <p className="aurora__line">{t.aurora.tooBright}</p>}
                  <dl className="aurora__nums">
                    <div>
                      <dt>{t.aurora.overhead}</dt>
                      <dd className="num">{view.overhead}%</dd>
                    </div>
                    <div>
                      <dt>{t.aurora.horizon}</dt>
                      <dd className="num">{view.horizon}%</dd>
                    </div>
                  </dl>
                  <ul className="aurora__lines">
                    <li>
                      {view.window
                        ? t.aurora.dark(fmt.dateTime(view.window.start), `${fmt.time(view.window.end)} UTC`)
                        : t.aurora.noDark}
                    </li>
                    <li>{t.aurora.magLat(fmt.num(view.mlat, 1))}</li>
                    {view.peak != null && viewLat != null && <li>{t.aurora.viewLine(formatKp(view.peak), fmt.num(viewLat, 0))}</li>}
                  </ul>
                </>
              )}
            </>
          )}
          <p className="aurora__explain note">{t.aurora.explain}</p>
        </div>
      </div>
    </Panel>
  );
}
