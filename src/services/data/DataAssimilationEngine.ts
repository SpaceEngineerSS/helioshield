// Implements high-cadence Data Assimilation with NASA API, Interpolation & Lagrange Lag

import { PHYSICS_CONSTANTS } from '../../lib/constants';
import { openDB, type IDBPDatabase } from 'idb';
import { PRESETS } from '../../components/presets/HistoricalPresets';

export interface SolarWindObservation {
  timestamp: number;
  speed: number;   // km/s
  density: number; // particles/cm^3
  bz: number;      // nT
}

export class DataAssimilationEngine {
  private nasaApiKey: string;
  private dbPromise: Promise<IDBPDatabase | null>;
  public isOfflineMode = false;
  public isSimulationMode = false;
  public activePresetId: string | null = null;

  public activeCache = {
    solarWind: [] as any[],
    cmes: [] as any[],
    flares: [] as any[]
  };

  // Simple event target for broadcasting simulation mode
  public events = new EventTarget();

  constructor() {
    // VITE_ prefix is required for Vite to expose env variables
    this.nasaApiKey = import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY';
    
    // Initialize IndexedDB
    this.dbPromise = this.initDB();
  }

  private async initDB() {
    if (typeof window === 'undefined') return null;
    return openDB('helioshield-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('solar-wind')) {
          const store = db.createObjectStore('solar-wind', { keyPath: 'timestamp' });
          store.createIndex('by-time', 'timestamp');
        }
      },
    });
  }

  /**
   * Caches an observation to IndexedDB
   */
  public async cacheObservation(obs: SolarWindObservation) {
    try {
      const db = await this.dbPromise;
      if (!db) return;
      await db.put('solar-wind', obs);
    } catch (e) {
      console.error('Failed to cache observation:', e);
    }
  }

  /**
   * Retrieves the last 7 days of cached observations from IndexedDB
   */
  public async getCachedObservations(): Promise<SolarWindObservation[]> {
    try {
      const db = await this.dbPromise;
      if (!db) return [];
      
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const tx = db.transaction('solar-wind', 'readonly');
      const index = tx.store.index('by-time');
      
      const records = await index.getAll(IDBKeyRange.lowerBound(sevenDaysAgo));
      return records;
    } catch (e) {
      console.error('Failed to retrieve cached observations:', e);
      return [];
    }
  }

  /**
   * Internal helper to handle rate limits gracefully
   */
  private async handleFetchWithFallback(url: string, errorContext: string): Promise<any> {
    try {
      const response = await fetch(url);
      if (response.status === 429 || response.status === 403) {
        return this.triggerSimulationMode();
      }
      if (!response.ok) throw new Error(`${errorContext}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch ${errorContext}:`, error);
      return null;
    }
  }

  /**
   * Triggers the historical simulation fallback mode
   */
  public triggerSimulationMode(): any {
    // Pick a random preset
    const presetKeys = Object.keys(PRESETS);
    const randomKey = presetKeys[Math.floor(Math.random() * presetKeys.length)];
    const preset = PRESETS[Number(randomKey)];
    
    this.activePresetId = preset.id;
    
    // Map the preset data into the engine's active cache so downstream services
    // (KinematicsEngine, GICCalculator) immediately process the injected physics parameters.
    this.activeCache.solarWind = preset.solarWind;
    this.activeCache.cmes = preset.cmes;
    this.activeCache.flares = preset.flares;

    if (!this.isSimulationMode) {
      this.isSimulationMode = true;
      console.warn(`Live Data Limit Reached - Running in Historical Simulation Mode (${preset.label})`);
      this.events.dispatchEvent(new CustomEvent('simulation-mode', {
        detail: { 
          message: "Live Data Limit Reached - Running in Historical Simulation Mode",
          presetId: preset.id 
        }
      }));
    }
    
    return []; 
  }

  /**
   * Fetches NASA DONKI CME data.
   */
  public async fetchDonkiCMEData(): Promise<any> {
    return this.handleFetchWithFallback(
      `https://api.nasa.gov/DONKI/CME?api_key=${this.nasaApiKey}`,
      'DONKI API Error'
    );
  }

  /**
   * Fetches GOES X-ray flux data (Simulated endpoint for architecture demonstration).
   */
  public async fetchGoesXrayData(): Promise<any> {
    return this.handleFetchWithFallback(
      `https://api.nasa.gov/DONKI/FLR?api_key=${this.nasaApiKey}`,
      'GOES/FLR API Error'
    );
  }

  /**
   * Linear Interpolation to handle data gaps in high-cadence streams.
   */
  public interpolateDataGap(
    startPoint: SolarWindObservation, 
    endPoint: SolarWindObservation, 
    targetTime: number
  ): SolarWindObservation {
    const timeDiff = endPoint.timestamp - startPoint.timestamp;
    if (timeDiff === 0) return startPoint;

    const ratio = (targetTime - startPoint.timestamp) / timeDiff;

    return {
      timestamp: targetTime,
      speed: startPoint.speed + ratio * (endPoint.speed - startPoint.speed),
      density: startPoint.density + ratio * (endPoint.density - startPoint.density),
      bz: startPoint.bz + ratio * (endPoint.bz - startPoint.bz)
    };
  }

  /**
   * Lagrange-Point Lag Logic.
   * Calculates the arrival time of a solar wind parcel at Earth's bow shock
   * based on its measured bulk velocity at L1.
   * 
   * @param observationTime Timestamp of the observation at L1
   * @param bulkVelocityKmS Bulk velocity in km/s
   * @returns Predicted arrival time timestamp at Earth
   */
  public calculateEarthArrivalTime(observationTime: number, bulkVelocityKmS: number): number {
    if (bulkVelocityKmS <= 0) return observationTime; // Fallback for invalid data
    
    // Distance from L1 to Earth in km
    const distanceKm = PHYSICS_CONSTANTS.L1_DISTANCE_KM;
    
    // Time = Distance / Velocity (seconds)
    const transitTimeSeconds = distanceKm / bulkVelocityKmS;
    
    // Return arrival timestamp (milliseconds)
    return observationTime + (transitTimeSeconds * 1000);
  }
}

export const dataEngine = new DataAssimilationEngine();
