import { useT } from '../../i18n';

export type Tab = 'now' | 'charts' | 'events' | 'aurora';

export function MobileTabs({ tab, onChange, replay }: { tab: Tab; onChange: (t: Tab) => void; replay: boolean }) {
  const t = useT();
  const tabs: Tab[] = replay ? ['now', 'charts', 'events'] : ['now', 'charts', 'events', 'aurora'];
  return (
    <nav className="tabs" aria-label={t.tabs.label}>
      {tabs.map((id) => (
        <button
          key={id}
          type="button"
          className="tabs__item"
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => {
            onChange(id);
            window.scrollTo({ top: 0 });
          }}
        >
          {t.tabs[id]}
        </button>
      ))}
    </nav>
  );
}
