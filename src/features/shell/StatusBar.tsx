import { useStore } from '../../state/store';
import { useDataset } from '../../state/derive';
import { useFormat, useT } from '../../i18n';
import { useNow } from '../../ui/hooks';
import { FEED_IDS, SOURCES } from '../../data/sources';
import { ARCHIVE } from '../../data/archive';
import type { FeedId } from '../../data/types';

type Health = 'ok' | 'stale' | 'down' | 'wait';

/**
 * The instrument status line: one lamp per feed, plus a plain sentence about
 * the state that matters most right now.
 */
export function StatusBar() {
  const t = useT();
  const fmt = useFormat();
  const d = useDataset();
  const feeds = useStore((s) => s.feeds);
  const replay = useStore((s) => s.replay);
  const now = useNow(15_000);
  const online = typeof navigator === 'undefined' || navigator.onLine;

  const health = (id: FeedId): Health => {
    const f = feeds[id];
    if (f.pending && !f.data) return 'wait';
    if (f.error && !f.data) return 'down';
    if (f.error || f.restored) return 'stale';
    const age = now - (f.fetchedAt ?? 0);
    return age > SOURCES[id].ttl * 1000 * 4 ? 'stale' : 'ok';
  };

  let sentence: string;
  if (replay) {
    const entry = ARCHIVE.find((e) => e.id === replay.id);
    const ev = entry ? t.events[entry.key as keyof typeof t.events] : null;
    sentence = t.status.replaying(ev ? `${ev.name}, ${ev.when}` : replay.id);
  } else if (!online && feeds.solarwind.fetchedAt) {
    sentence = t.status.offline(fmt.relative(feeds.solarwind.fetchedAt, now));
  } else if (feeds.solarwind.pending && !feeds.solarwind.data) {
    sentence = t.status.loading;
  } else {
    const down = FEED_IDS.filter((id) => health(id) === 'down').map((id) => t.feeds[id]);
    const last = d.sw?.t.at(-1);
    sentence = down.length
      ? t.status.unreachable(down.join(', '))
      : last
        ? `${t.status.observing} · ${t.status.l1Age(fmt.duration(now - last))}`
        : t.status.observing;
  }

  return (
    <div className="statusbar">
      <p className="statusbar__line" aria-live="polite">
        <span className={`dot ${replay ? '' : 'dot--live'}`} style={{ background: replay ? 'var(--model)' : undefined }} aria-hidden="true" />
        {sentence}
      </p>
      {!replay && (
        <ul className="lamps" aria-label={t.status.sources}>
          {FEED_IDS.map((id) => {
            const h = health(id);
            return (
              <li key={id} className={`lamp lamp--${h}`} title={`${t.feeds[id]} · ${SOURCES[id].credit}`}>
                <span className="lamp__led" aria-hidden="true" />
                <span className="lamp__name">{t.feeds[id]}</span>
                <span className="sr-only">{h}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
