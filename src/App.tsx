import { lazy, Suspense, useEffect, useState } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { startPolling } from './data/poller';
import { DatasetContext, SnapshotContext, useBuildDataset, useBuildSnapshot } from './state/derive';
import { usePlaybackDriver } from './state/playback';
import { useStore } from './state/store';
import { useUrlState } from './state/url';
import { useMedia } from './ui/hooks';
import { useT } from './i18n';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { Header } from './features/shell/Header';
import { StatusBar } from './features/shell/StatusBar';
import { Footer } from './features/shell/Footer';
import { MobileTabs, type Tab } from './features/shell/MobileTabs';
import { Conditions } from './features/conditions/Conditions';
import { CmePanel } from './features/cme/CmePanel';
import { FlaresPanel } from './features/flares/FlaresPanel';
import { OutlookPanel } from './features/outlook/OutlookPanel';
import { AlertsPanel } from './features/alerts/AlertsPanel';
import { useKpNotifications } from './features/alerts/notify';
import { EventStory } from './features/replay/EventStory';
import { ScenePanel } from './features/scene/ScenePanel';
import './styles/app.css';

const ChartsPanel = lazy(() => import('./features/charts/ChartsPanel'));
const AuroraPanel = lazy(() => import('./features/aurora/AuroraPanel'));

function PanelFallback({ retry }: { retry: () => void }) {
  const t = useT();
  return (
    <div className="panel panel--error" role="alert">
      <div className="panel__body">
        <p>{t.errors.boundary}</p>
        <button type="button" className="btn" onClick={retry}>
          {t.errors.retry}
        </button>
      </div>
    </div>
  );
}

function Slot({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <div className={`slot ${className}`}>
      <ErrorBoundary fallback={(retry) => <PanelFallback retry={retry} />}>
        <Suspense fallback={<div className="panel skeleton slot-skeleton" aria-hidden="true" />}>{children}</Suspense>
      </ErrorBoundary>
    </div>
  );
}

function SkipLink() {
  const t = useT();
  return (
    <a className="skip" href="#main">
      {t.header.skip}
    </a>
  );
}

function useDocumentPrefs() {
  const lang = useStore((s) => s.lang);
  const theme = useStore((s) => s.theme);
  const t = useT();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.meta.title;
  }, [lang, t]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'paper' ? '#ece5d6' : '#0e0d0b');
  }, [theme]);
}

export default function App() {
  useEffect(() => startPolling(), []);
  useDocumentPrefs();
  useUrlState();

  const dataset = useBuildDataset();
  const snapshot = useBuildSnapshot(dataset);
  usePlaybackDriver(dataset);
  useKpNotifications(snapshot, dataset.kind === 'live');

  const mobile = useMedia('(max-width: 760px)');
  const [tab, setTab] = useState<Tab>('now');
  const replay = dataset.kind === 'replay';
  const show = (t: Tab) => !mobile || tab === t;

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <DatasetContext.Provider value={dataset}>
          <SnapshotContext.Provider value={snapshot}>
            <SkipLink />
            <Header />
            <StatusBar />
            {mobile && <MobileTabs tab={tab} onChange={setTab} replay={replay} />}
            <main id="main" className="grid" data-mode={dataset.kind}>
              {show('now') && (
                <>
                  <Slot className="s-conditions">
                    <Conditions />
                  </Slot>
                  <Slot className="s-scene">
                    <ScenePanel />
                  </Slot>
                </>
              )}
              {show('events') && (
                <Slot className="s-cme">
                  <CmePanel />
                </Slot>
              )}
              {show('charts') && (
                <Slot className="s-charts">
                  <ChartsPanel />
                </Slot>
              )}
              {replay
                ? show('events') && (
                    <Slot className="s-story">
                      <EventStory />
                    </Slot>
                  )
                : show('aurora') && (
                    <Slot className="s-aurora">
                      <AuroraPanel />
                    </Slot>
                  )}
              {!replay && show('events') && (
                <Slot className="s-alerts">
                  <AlertsPanel />
                </Slot>
              )}
              {show('events') && (
                <Slot className="s-flares">
                  <FlaresPanel />
                </Slot>
              )}
              {!replay && show('aurora') && (
                <Slot className="s-outlook">
                  <OutlookPanel />
                </Slot>
              )}
            </main>
            <Footer />
          </SnapshotContext.Provider>
        </DatasetContext.Provider>
      </LazyMotion>
    </MotionConfig>
  );
}
