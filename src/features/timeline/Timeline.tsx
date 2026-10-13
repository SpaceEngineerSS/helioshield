import { useEffect } from 'react';
import { useStore } from '../../state/store';
import { useDataset } from '../../state/derive';
import { stepCursor } from '../../state/playback';
import { useFormat, useT } from '../../i18n';
import { Pause, Play, Live, Step } from '../../ui/icons';
import { Segmented } from '../../ui/Segmented';
import { HOUR_MS, MINUTE_MS } from '../../model/constants';
import './timeline.css';

/**
 * Transport bar under the charts: play/pause, step, rate, scrubber.
 * The scrubber is a native range input so it works with keyboard and screen
 * readers without extra code.
 */
export function Timeline() {
  const t = useT();
  const fmt = useFormat();
  const d = useDataset();
  const cursor = useStore((s) => s.cursor);
  const playing = useStore((s) => s.playing);
  const rate = useStore((s) => s.rate);
  const { setPlaying, setCursor, setRate } = useStore.getState();

  const [start, end] = d.range;
  const value = cursor ?? end;
  const following = d.kind === 'live' && cursor == null;
  const step = d.kind === 'live' ? 10 * MINUTE_MS : 30 * MINUTE_MS;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable], dialog')) return;
      if (e.key === ' ' && !el.closest('button')) {
        e.preventDefault();
        useStore.getState().setPlaying(!useStore.getState().playing);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (el.closest('[role="slider"], input[type="range"]')) return;
        e.preventDefault();
        stepCursor(d, (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? HOUR_MS : step));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d, step]);

  const pct = end > start ? ((value - start) / (end - start)) * 100 : 100;

  return (
    <div className="transport" aria-label={t.timeline.scrub}>
      <div className="transport__buttons">
        <button type="button" className="btn btn--icon" onClick={() => stepCursor(d, -step)} aria-label={`−${fmt.duration(step)}`}>
          <Step dir="back" />
        </button>
        <button
          type="button"
          className={`btn transport__play ${playing ? 'btn--on' : ''}`}
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? t.timeline.pause : t.timeline.play}
          aria-keyshortcuts="Space"
        >
          {playing ? <Pause /> : <Play />}
          <span className="transport__play-label">{playing ? t.timeline.pause : t.timeline.play}</span>
        </button>
        <button type="button" className="btn btn--icon" onClick={() => stepCursor(d, step)} aria-label={`+${fmt.duration(step)}`}>
          <Step />
        </button>
      </div>

      <div className="transport__track">
        <div className="transport__times num" aria-hidden="true">
          <span>{fmt.dateTime(start)}</span>
          <span className="transport__now">{following ? t.timeline.following : `${fmt.dateTime(value)} UTC`}</span>
          <span>{fmt.dateTime(end)}</span>
        </div>
        <input
          type="range"
          className="transport__range"
          min={start}
          max={end}
          step={MINUTE_MS}
          value={value}
          style={{ ['--pct' as string]: `${pct}%` }}
          aria-label={t.timeline.scrub}
          aria-valuetext={`${fmt.dateTime(value)} UTC`}
          onChange={(e) => {
            setPlaying(false);
            const v = Number(e.target.value);
            setCursor(d.kind === 'live' && v >= end - MINUTE_MS ? null : v);
          }}
        />
        <div className="transport__marks" aria-hidden="true">
          {d.marks.map((m) => (
            <span key={`${m.key}${m.t}`} className="transport__mark" style={{ left: `${((m.t - start) / (end - start)) * 100}%` }} />
          ))}
        </div>
      </div>

      <div className="transport__right">
        <Segmented<1 | 2 | 4>
          label={t.timeline.rate}
          value={rate}
          options={[1, 2, 4].map((n) => ({ value: n as 1 | 2 | 4, label: t.timeline.rateValue(n) }))}
          onChange={setRate}
        />
        {d.kind === 'live' && (
          <button type="button" className="btn" disabled={following} onClick={() => (setPlaying(false), setCursor(null))}>
            <Live />
            {t.timeline.toLive}
          </button>
        )}
      </div>
      <p className="sr-only">{t.timeline.keys}</p>
    </div>
  );
}
