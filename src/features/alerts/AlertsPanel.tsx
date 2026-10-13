import { useState } from 'react';
import { useStore } from '../../state/store';
import { useFormat, useT } from '../../i18n';
import { Panel } from '../../ui/Panel';
import { Signal } from '../../ui/icons';
import { notificationsSupported, requestNotify } from './notify';
import type { AlertKind } from '../../data/types';
import './alerts.css';

const KIND_TONE: Record<AlertKind, string> = {
  alert: 'var(--lv4)',
  warning: 'var(--lv3)',
  watch: 'var(--lv2)',
  summary: 'var(--text-3)',
  other: 'var(--text-3)',
};

function NotifyControl() {
  const t = useT();
  const notify = useStore((s) => s.notify);
  const setPrefs = useStore((s) => s.setPrefs);
  const [denied, setDenied] = useState(() => notificationsSupported() && Notification.permission === 'denied');

  if (!notificationsSupported()) return null;

  const toggle = async () => {
    if (notify.enabled) {
      setPrefs({ notify: { ...notify, enabled: false } });
      return;
    }
    const ok = await requestNotify();
    setDenied(!ok);
    if (ok) setPrefs({ notify: { ...notify, enabled: true } });
  };

  return (
    <div className="notify">
      <div className="notify__row">
        <button type="button" className="btn" aria-pressed={notify.enabled} onClick={toggle}>
          <Signal />
          {t.alerts.notify}
        </button>
        <label className="notify__threshold">
          <span>{t.alerts.notifyAt(notify.kp)}</span>
          <input
            type="range"
            min={4}
            max={9}
            step={1}
            value={notify.kp}
            onChange={(e) => setPrefs({ notify: { ...notify, kp: Number(e.target.value) } })}
          />
        </label>
      </div>
      <p className="notify__caveat note">{denied ? t.alerts.notifyDenied : t.alerts.notifyCaveat}</p>
    </div>
  );
}

export function AlertsPanel() {
  const t = useT();
  const fmt = useFormat();
  const alerts = useStore((s) => s.feeds.alerts.data);
  const [open, setOpen] = useState<string | null>(null);
  // Summaries repeat what alerts already said; keep the list readable.
  const list = (alerts ?? []).filter((a) => a.kind !== 'summary').slice(0, 14);

  return (
    <Panel index="07" title={t.alerts.title} meta={t.alerts.meta} order={6}>
      <NotifyControl />
      {list.length === 0 ? (
        <p className="empty">{t.alerts.none}</p>
      ) : (
        <ol className="bulletins">
          {list.map((a) => {
            const expanded = open === a.id;
            return (
              <li key={a.id} className="bulletin" style={{ ['--tone' as string]: KIND_TONE[a.kind] }}>
                <button
                  type="button"
                  className="bulletin__head"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : a.id)}
                >
                  <span className="bulletin__kind">{t.alerts.kinds[a.kind]}</span>
                  <span className="bulletin__title">{a.title.replace(/^(EXTENDED |CANCEL )?(ALERT|WARNING|WATCH):\s*/, '$1')}</span>
                  <time className="bulletin__time num" dateTime={new Date(a.issued).toISOString()}>
                    {fmt.dateTime(a.issued)}
                  </time>
                </button>
                {expanded && <pre className="bulletin__body">{a.body}</pre>}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
