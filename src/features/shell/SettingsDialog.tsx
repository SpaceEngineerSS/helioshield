import { forwardRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore, type Quality, type Theme, type Lang } from '../../state/store';
import { useT } from '../../i18n';
import { Segmented } from '../../ui/Segmented';
import { Close } from '../../ui/icons';
import { withTransition } from '../../state/url';

export const SettingsDialog = forwardRef<HTMLDialogElement>(function SettingsDialog(_, ref) {
  const t = useT();
  // Subscribe to preferences only; the cursor changes many times a second during playback.
  const s = useStore(
    useShallow((st) => ({ scene: st.scene, quality: st.quality, theme: st.theme, lang: st.lang, setPrefs: st.setPrefs })),
  );
  const close = () => (ref as React.RefObject<HTMLDialogElement | null>).current?.close();

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="settings-title"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="sheet__inner">
        <header className="sheet__head">
          <h2 id="settings-title" className="panel__title">
            {t.settings.title}
          </h2>
          <button type="button" className="btn btn--icon btn--ghost" onClick={close} aria-label={t.settings.close}>
            <Close />
          </button>
        </header>

        <div className="sheet__row">
          <span className="label">{t.settings.scene}</span>
          <Segmented
            label={t.settings.scene}
            value={s.scene ? 'on' : 'off'}
            options={[
              { value: 'on', label: t.settings.sceneOn },
              { value: 'off', label: t.settings.sceneOff },
            ]}
            onChange={(v) => s.setPrefs({ scene: v === 'on' })}
          />
        </div>

        <div className="sheet__row">
          <span className="label">{t.settings.quality}</span>
          <Segmented<Quality>
            label={t.settings.quality}
            value={s.quality}
            options={[
              { value: 'auto', label: t.settings.qualityAuto },
              { value: 'low', label: t.settings.qualityLow },
              { value: 'medium', label: t.settings.qualityMedium },
              { value: 'high', label: t.settings.qualityHigh },
            ]}
            onChange={(quality) => s.setPrefs({ quality })}
          />
          <p className="sheet__note">{t.settings.qualityNote}</p>
        </div>

        <div className="sheet__row">
          <span className="label">{t.settings.theme}</span>
          <Segmented<Theme>
            label={t.settings.theme}
            value={s.theme}
            options={[
              { value: 'night', label: t.settings.themeNight },
              { value: 'paper', label: t.settings.themePaper },
            ]}
            onChange={(theme) => withTransition(() => s.setPrefs({ theme }))}
          />
        </div>

        <div className="sheet__row">
          <span className="label">{t.settings.language}</span>
          <Segmented<Lang>
            label={t.settings.language}
            value={s.lang}
            options={[
              { value: 'en', label: 'English' },
              { value: 'tr', label: 'Türkçe' },
            ]}
            onChange={(lang) => s.setPrefs({ lang })}
          />
        </div>
      </div>
    </dialog>
  );
});
