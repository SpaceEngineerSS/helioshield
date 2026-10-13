import { useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { useFormat, useT } from '../../i18n';
import { useNow } from '../../ui/hooks';
import { Logo } from '../../ui/Logo';
import { Dial, Live, Reel, Refresh } from '../../ui/icons';
import { refreshAll } from '../../data/poller';
import { closeReplay } from '../../state/url';
import { ReplayPicker } from './ReplayPicker';
import { SettingsDialog } from './SettingsDialog';
import './shell.css';

function Clock() {
  const now = useNow(1000);
  const iso = new Date(now).toISOString();
  return (
    <time className="clock num" dateTime={iso} aria-label={`${iso.slice(11, 16)} UTC`}>
      {iso.slice(11, 19)}
      <span className="clock__zone">UTC</span>
    </time>
  );
}

export function Header() {
  const t = useT();
  const fmt = useFormat();
  const replay = useStore((s) => s.replay);
  const lang = useStore((s) => s.lang);
  const setPrefs = useStore((s) => s.setPrefs);
  const [picker, setPicker] = useState(false);
  const settingsRef = useRef<HTMLDialogElement>(null);
  const now = useNow(60_000);

  return (
    <header className="masthead">
      <div className="masthead__brand">
        <Logo size={30} />
        <div className="masthead__words">
          <span className="masthead__name">HelioShield</span>
          <span className="masthead__tag">{t.brand.tagline}</span>
        </div>
      </div>

      <nav className="masthead__mode" aria-label={`${t.header.live} / ${t.header.replay}`}>
        <button type="button" className="btn" aria-pressed={!replay} onClick={() => replay && closeReplay()}>
          <Live />
          {t.header.live}
        </button>
        <div className="picker-anchor">
          <button
            type="button"
            className="btn"
            aria-pressed={!!replay}
            aria-expanded={picker}
            aria-haspopup="dialog"
            onClick={() => setPicker((v) => !v)}
          >
            <Reel />
            {t.header.replay}
          </button>
          {picker && <ReplayPicker onClose={() => setPicker(false)} />}
        </div>
      </nav>

      <div className="masthead__tools">
        <span className="masthead__date num" aria-hidden="true">
          {fmt.fullDate(now)}
        </span>
        <Clock />
        <div className="seg" role="group" aria-label={t.header.language}>
          {(['en', 'tr'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className="btn btn--ghost"
              aria-pressed={lang === l}
              lang={l}
              onClick={() => setPrefs({ lang: l })}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {!replay && (
          <button type="button" className="btn btn--icon" onClick={refreshAll} aria-label={t.header.refresh} title={t.header.refresh}>
            <Refresh />
          </button>
        )}
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => settingsRef.current?.showModal()}
          aria-label={t.header.settings}
          title={t.header.settings}
        >
          <Dial />
        </button>
      </div>
      <SettingsDialog ref={settingsRef} />
    </header>
  );
}
