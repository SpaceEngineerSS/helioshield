import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

interface Props {
  value: number;
  format: (v: number) => string;
  /** Skip the tween for values that change continuously (playback scrubbing). */
  instant?: boolean;
}

/**
 * Tweens the digits when a reading changes, writing straight to the DOM so a
 * new reading does not re-render the panel 60 times.
 */
export function AnimatedNumber({ value, format, instant }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current;
    if (instant || reduce || from === value || !Number.isFinite(from)) {
      shown.current = value;
      el.textContent = format(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.5,
      ease: [0.2, 0.7, 0.1, 1],
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, format, instant, reduce]);

  return <span ref={ref}>{format(value)}</span>;
}
