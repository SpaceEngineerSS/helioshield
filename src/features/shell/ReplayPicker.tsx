import { m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ARCHIVE } from '../../data/archive';
import { useStore } from '../../state/store';
import { useT } from '../../i18n';
import { openReplay } from '../../state/url';
import { levelColor } from '../../ui/level-color';

export function ReplayPicker({ onClose }: { onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const current = useStore((s) => s.replay?.id);
  const loading = useStore((s) => s.replayLoading);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const anchor = ref.current?.parentElement;
      if (anchor && !anchor.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const pick = async (id: string) => {
    setError(false);
    try {
      await openReplay(id);
      onClose();
    } catch {
      setError(true);
    }
  };

  return (
    <m.div
      ref={ref}
      className="picker"
      role="dialog"
      aria-label={t.replay.pick}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <p className="label picker__head">{t.replay.title}</p>
      <ul className="picker__list">
        {ARCHIVE.map((e) => {
          const ev = t.events[e.key as keyof typeof t.events];
          return (
            <li key={e.id}>
              <button
                type="button"
                className="picker__item"
                aria-current={current === e.id}
                aria-busy={loading === e.id}
                onClick={() => pick(e.id)}
              >
                <span className="picker__g num" style={{ background: levelColor(e.peakG) }}>
                  G{e.peakG}
                </span>
                <span className="picker__text">
                  <span className="picker__name">{ev.name}</span>
                  <span className="picker__when num">{loading === e.id ? t.replay.loading : ev.when}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="picker__error" role="alert">
          {t.replay.error}
        </p>
      )}
      <p className="picker__foot note">{t.replay.meta}</p>
    </m.div>
  );
}
