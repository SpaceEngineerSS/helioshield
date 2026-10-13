/**
 * Compact, JSON-friendly shapes shared by the edge feed (api/feed.ts),
 * the client fallback, and the replay archive. All times are epoch ms (UTC).
 */

export type Num = number | null;

/** 1-minute solar wind at L1 (plasma + IMF in GSM) merged on a common clock. */
export interface SolarWind {
  t: number[];
  speed: Num[];
  density: Num[];
  temp: Num[];
  bt: Num[];
  by: Num[];
  bz: Num[];
  /** Spacecraft that produced the newest sample (DSCOVR "SOLAR1", ACE, IMAP …). */
  spacecraft: string | null;
}

export type KpKind = 'observed' | 'estimated' | 'predicted';

/** 3-hour planetary Kp: past week observed, today estimated, next 3 days predicted. */
export interface KpSeries {
  t: number[];
  kp: number[];
  kind: KpKind[];
}

/** NOAA 1-minute estimated Kp (the official nowcast). */
export interface KpNowcast {
  t: number[];
  kp: number[];
}

/** GOES 0.1–0.8 nm X-ray flux. */
export interface Xray {
  t: number[];
  flux: Num[];
  satellite: number | null;
}

export interface Flare {
  begin: number;
  peak: number;
  end: number | null;
  /** e.g. "M2.3" */
  cls: string;
  /** Peak 0.1–0.8 nm flux, W/m² */
  flux: number;
  /** Heliographic location like "N14E90", when DONKI knows it. */
  location?: string | null;
  region?: number | null;
}

export interface EnlilArrival {
  /** Model shock arrival at Earth, epoch ms. */
  arrival: number;
  glancing: boolean;
  /** Kp range CCMC gave with the run, when present. */
  kpLow: number | null;
  kpHigh: number | null;
}

export interface Cme {
  id: string;
  start: number;
  /** Time the front passed 21.5 R☉, when analysed. */
  t21: number | null;
  speed: number | null;
  halfAngle: number | null;
  lat: number | null;
  lon: number | null;
  /** DONKI speed type S/C/O/R/ER */
  type: string | null;
  source: string | null;
  note: string;
  link: string | null;
  enlil: EnlilArrival | null;
}

export type AlertKind = 'alert' | 'warning' | 'watch' | 'summary' | 'other';

export interface SpaceAlert {
  id: string;
  issued: number;
  kind: AlertKind;
  code: string;
  title: string;
  body: string;
}

export interface Ovation {
  observed: number;
  forecast: number;
  /** 360 × 181, longitude-major, latitude −90…90. Probability in percent. */
  values: number[];
}

export interface ScaleDay {
  date: string;
  g: number | null;
  rMinorProb: number | null;
  rMajorProb: number | null;
  sProb: number | null;
}

export interface Scales {
  issued: number;
  current: { g: number; r: number; s: number };
  days: ScaleDay[];
}

export interface FeedMap {
  solarwind: SolarWind;
  kp: KpSeries;
  kpnow: KpNowcast;
  xray: Xray;
  flares: Flare[];
  cme: Cme[];
  alerts: SpaceAlert[];
  ovation: Ovation;
  scales: Scales;
}

export type FeedId = keyof FeedMap;

export interface FeedEnvelope<K extends FeedId = FeedId> {
  id: K;
  fetchedAt: number;
  data: FeedMap[K];
}
