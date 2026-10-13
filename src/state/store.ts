import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { FeedId, FeedMap } from '../data/types';
import type { ArchiveEvent } from '../data/archive';

export interface FeedSlot<K extends FeedId = FeedId> {
  data: FeedMap[K] | null;
  fetchedAt: number | null;
  error: string | null;
  /** True only while the very first request for this feed is in flight. */
  pending: boolean;
  /** Came from the IndexedDB snapshot rather than the network this session. */
  restored: boolean;
}

export type Feeds = { [K in FeedId]: FeedSlot<K> };

export type Lang = 'en' | 'tr';
export type Theme = 'night' | 'paper';
export type Quality = 'auto' | 'low' | 'medium' | 'high';

export interface Place {
  lat: number;
  lon: number;
  label: string;
}

export interface Prefs {
  lang: Lang;
  theme: Theme;
  quality: Quality;
  scene: boolean;
  place: Place | null;
  notify: { enabled: boolean; kp: number };
}

export interface AppState extends Prefs {
  feeds: Feeds;
  /** null while live; otherwise the loaded archive event. */
  replay: ArchiveEvent | null;
  replayLoading: string | null;
  /** Time the dashboard is looking at. null follows the newest sample. */
  cursor: number | null;
  playing: boolean;
  /** Playback rate as a multiple of "window per 60 s". */
  rate: 1 | 2 | 4;

  setFeed: <K extends FeedId>(id: K, patch: Partial<FeedSlot<K>>) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
  setReplay: (event: ArchiveEvent | null, cursor?: number) => void;
  setReplayLoading: (id: string | null) => void;
  setCursor: (t: number | null) => void;
  setPlaying: (playing: boolean) => void;
  setRate: (rate: 1 | 2 | 4) => void;
}

const emptySlot = (): FeedSlot => ({ data: null, fetchedAt: null, error: null, pending: true, restored: false });

const initialFeeds = {
  solarwind: emptySlot(),
  kp: emptySlot(),
  kpnow: emptySlot(),
  xray: emptySlot(),
  flares: emptySlot(),
  cme: emptySlot(),
  alerts: emptySlot(),
  ovation: emptySlot(),
  scales: emptySlot(),
} as Feeds;

/** localStorage can throw (private mode, blocked storage); never let that break the app. */
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

function defaultLang(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  } catch {
    return 'en';
  }
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      lang: defaultLang(),
      theme: 'night',
      quality: 'auto',
      scene: true,
      place: null,
      notify: { enabled: false, kp: 6 },

      feeds: initialFeeds,
      replay: null,
      replayLoading: null,
      cursor: null,
      playing: false,
      rate: 1,

      setFeed: (id, patch) =>
        set((s) => ({ feeds: { ...s.feeds, [id]: { ...s.feeds[id], ...patch } } })),
      setPrefs: (patch) => set(patch),
      setReplay: (replay, cursor) =>
        set({ replay, cursor: replay ? (cursor ?? replay.range[0]) : null, playing: false, replayLoading: null }),
      setReplayLoading: (replayLoading) => set({ replayLoading }),
      setCursor: (cursor) => set({ cursor }),
      setPlaying: (playing) => set({ playing }),
      setRate: (rate) => set({ rate }),
    }),
    {
      name: 'helioshield:prefs',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): Prefs => ({
        lang: s.lang,
        theme: s.theme,
        quality: s.quality,
        scene: s.scene,
        place: s.place,
        notify: s.notify,
      }),
    },
  ),
);
