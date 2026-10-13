import { useEffect, useRef } from 'react';
import { useStore } from '../../state/store';
import type { Snapshot } from '../../state/derive';
import { dictFor } from '../../i18n';
import { formatKp, gScale } from '../../model/kp';

const COOLDOWN = 3 * 3_600_000;

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotify(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

async function show(title: string, body: string) {
  // Through the service worker when there is one, so it also works as an installed app.
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: 'helioshield-kp' });
      return;
    }
  } catch {
    /* fall through */
  }
  new Notification(title, { body, icon: '/icons/icon-192.png', tag: 'helioshield-kp' });
}

/**
 * Fires once when the live Kp nowcast rises through the chosen threshold,
 * then stays quiet for a few hours so a storm does not become a stream of pings.
 */
export function useKpNotifications(snap: Snapshot, live: boolean): void {
  const enabled = useStore((s) => s.notify.enabled);
  const threshold = useStore((s) => s.notify.kp);
  const following = useStore((s) => s.cursor == null);
  const prev = useRef<number | null>(null);
  const lastSent = useRef(0);

  const kp = live && following ? snap.kpOfficial : null;

  useEffect(() => {
    const before = prev.current;
    prev.current = kp;
    if (!enabled || kp == null || before == null) return;
    if (!notificationsSupported() || Notification.permission !== 'granted') return;
    if (before < threshold && kp >= threshold && Date.now() - lastSent.current > COOLDOWN) {
      lastSent.current = Date.now();
      const t = dictFor(useStore.getState().lang);
      void show(t.alerts.notifyTitle(formatKp(kp)), t.alerts.notifyBody(gScale(kp)));
    }
  }, [kp, enabled, threshold]);
}
