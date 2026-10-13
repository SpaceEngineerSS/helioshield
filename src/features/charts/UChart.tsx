import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

interface Props {
  options: Omit<uPlot.Options, 'width' | 'height'>;
  data: uPlot.AlignedData;
  height: number;
  label: string;
  /** Called with the instance so callers can redraw it from outside React. */
  onReady?: (u: uPlot | null) => void;
}

/**
 * Thin uPlot wrapper. The chart is created once per `options` identity and
 * only gets setData() when the data changes; resizing follows the container.
 */
export function UChart({ options, data, height, label, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const u = new uPlot({ ...options, width: Math.max(200, el.clientWidth), height }, latest.current, el);
    plot.current = u;
    onReady?.(u);

    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 0 && Math.abs(w - u.width) > 1) u.setSize({ width: w, height });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      onReady?.(null);
      u.destroy();
      plot.current = null;
    };
    // `data` is pushed separately below; recreating on every data change would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, height]);

  useEffect(() => {
    // resetScales = true: x comes from the caller's range function, y re-fits.
    plot.current?.setData(data, true);
  }, [data]);

  return <div ref={host} className="uchart" role="img" aria-label={label} />;
}
