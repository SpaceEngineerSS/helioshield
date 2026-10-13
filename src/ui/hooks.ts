import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Wall-clock time, ticking every `ms`. Paused while the tab is hidden. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(id);
      setNow(Date.now());
      id = setInterval(() => setNow(Date.now()), ms);
    };
    const onVis = () => (document.visibilityState === 'visible' ? start() : clearInterval(id));
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ms]);
  return now;
}

/** True once the element has been on screen; false again when it leaves. */
export function useInView<T extends Element>(ref: RefObject<T | null>, margin = '100px'): boolean {
  // Without IntersectionObserver, treat everything as visible.
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return inView;
}
