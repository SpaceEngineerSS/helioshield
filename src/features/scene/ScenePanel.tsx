import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useStore } from '../../state/store';
import { useSnapshot } from '../../state/derive';
import { useFormat, useT } from '../../i18n';
import { Panel } from '../../ui/Panel';
import { useInView } from '../../ui/hooks';
import { Pause, Play } from '../../ui/icons';
import { initialTier, lowerTier, hasWebGL, type Tier } from './quality';
import { SceneSchematic } from './SceneSchematic';
import type { LabelRefs, SceneColors } from './Scene3D';
import './scene.css';

const Scene3D = lazy(() => import('./Scene3D'));

function readSceneColors(): SceneColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    bg: v('--surface'),
    text: v('--text'),
    text3: v('--text-3'),
    rule: v('--rule-strong'),
    sun: v('--sun-disc'),
    north: v('--north'),
    south: v('--south'),
    model: v('--model'),
  };
}

export function ScenePanel() {
  const t = useT();
  const fmt = useFormat();
  const snap = useSnapshot();
  const scenePref = useStore((s) => s.scene);
  const quality = useStore((s) => s.quality);
  const theme = useStore((s) => s.theme);
  const setPrefs = useStore((s) => s.setPrefs);
  const reduce = useReducedMotion();

  const [tier, setTier] = useState<Tier>(() => initialTier(quality));
  const [chosen, setChosen] = useState(quality);
  if (chosen !== quality) {
    setChosen(quality);
    setTier(initialTier(quality));
  }
  const onSlow = useCallback(() => {
    if (useStore.getState().quality === 'auto') setTier((x) => lowerTier(x));
  }, []);

  const [paused, setPaused] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const inView = useInView(host);
  // Mount the 3D view the first time it scrolls into view, then keep it.
  const [seen, setSeen] = useState(false);
  if (inView && !seen) setSeen(true);
  const animate = inView && !paused && !reduce;

  // Re-read the CSS tokens when the theme changes.
  const colors = useMemo(() => (theme ? readSceneColors() : readSceneColors()), [theme]);
  const labels = useRef<LabelRefs>({ sun: null, l1: null, earth: null, mp: null });

  // Round the magnetopause so playback does not rebuild the wire model every frame.
  const r0 = snap.magnetopause ? Math.round(snap.magnetopause.r0 * 10) / 10 : null;
  const alpha = snap.magnetopause ? Math.round(snap.magnetopause.alpha * 100) / 100 : null;
  const mp = useMemo(() => (r0 != null && alpha != null ? { r0, alpha } : null), [r0, alpha]);
  const sceneSnap = useMemo(() => ({ ...snap, magnetopause: mp }), [snap, mp]);

  const webgl = hasWebGL();
  const use3D = scenePref && webgl;

  return (
    <Panel
      index="02"
      title={t.scene.title}
      meta={<span className="num">{fmt.dateTime(snap.t)} UTC</span>}
      order={1}
      flush
      actions={
        use3D && !reduce ? (
          <button
            type="button"
            className="btn btn--icon btn--ghost"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? t.scene.resume : t.scene.pause}
            title={paused ? t.scene.resume : t.scene.pause}
          >
            {paused ? <Play /> : <Pause />}
          </button>
        ) : null
      }
    >
      <div className="scene" ref={host}>
        {use3D ? (
          <>
            <Suspense fallback={<div className="scene__loading note">{t.scene.loading}</div>}>
              {seen ? (
                <Scene3D snapshot={sceneSnap} tier={tier} colors={colors} animate={animate} labels={labels} onSlow={onSlow} />
              ) : null}
            </Suspense>
            <div className="scene__labels" aria-hidden="true">
              <span ref={(el) => void (labels.current.sun = el)} className="scene__label">
                {t.scene.sun}
              </span>
              <span ref={(el) => void (labels.current.l1 = el)} className="scene__label">
                {t.scene.l1}
                {snap.bz != null && <em className="num"> Bz {fmt.num(snap.bz, 1)}</em>}
              </span>
              <span ref={(el) => void (labels.current.earth = el)} className="scene__label">
                {t.scene.earth}
              </span>
              <span ref={(el) => void (labels.current.mp = el)} className="scene__label scene__label--dim">
                {t.scene.magnetopause}
                {mp && <em className="num"> {fmt.num(mp.r0, 1)} Rₑ</em>}
              </span>
            </div>
          </>
        ) : (
          <SceneSchematic snapshot={sceneSnap} />
        )}

        <div className="scene__legend">
          {snap.cmesInFlight.length > 0 && (
            <ul className="scene__cmes">
              {snap.cmesInFlight.slice(-3).map(({ track, au }) => (
                <li key={track.id}>
                  <span className="scene__swatch" aria-hidden="true" />
                  {t.scene.cme} · <span className="num">{fmt.dateTime(track.start)}</span> ·{' '}
                  {au >= 1 ? t.cme.arrived : t.cme.inFlight(fmt.num(au, 2))}
                </li>
              ))}
            </ul>
          )}
          <p className="scene__note note">
            {!webgl ? t.scene.fallback : !scenePref ? t.scene.off : t.scene.notToScale}
          </p>
          {!scenePref && webgl && (
            <button type="button" className="btn" onClick={() => setPrefs({ scene: true })}>
              {t.scene.enable}
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}
