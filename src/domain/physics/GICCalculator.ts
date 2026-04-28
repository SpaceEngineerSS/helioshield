// Wrapper for Web Worker implementing Lehtinen-Pirjola (1985) GIC model

import { SCIENTIFIC_THRESHOLDS } from '../../config/thresholds';

export class GICCalculator {
  private worker: Worker | null = null;
  private isProcessing = false;

  constructor() {
    // Initialize Web Worker using Vite's worker import syntax
    if (typeof window !== 'undefined') {
      this.worker = new Worker(new URL('./GICWorker.ts', import.meta.url), { type: 'module' });
    }
  }

  /**
   * Calculates the geoelectric field (E) from geomagnetic field variations (B)
   * 
   * @param bFieldSeries Array of B-field magnitudes (nT)
   * @param dtSeconds Time step between measurements in seconds
   * @returns Promise resolving to an array of E-field magnitudes (mV/km)
   */
  public async calculateEField(bFieldSeries: number[], dtSeconds: number = 60): Promise<number[]> {
    if (!this.worker) {
      console.warn("GIC Web Worker not initialized. Returning zeros.");
      return bFieldSeries.map(() => 0);
    }

    if (this.isProcessing) {
      throw new Error("GICCalculator is already processing a dataset.");
    }

    this.isProcessing = true;

    return new Promise((resolve, reject) => {
      const handleMessage = (e: MessageEvent) => {
        this.isProcessing = false;
        this.worker?.removeEventListener('message', handleMessage);
        this.worker?.removeEventListener('error', handleError);
        
        if (e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.eFieldSeries);
        }
      };

      const handleError = (error: ErrorEvent) => {
        this.isProcessing = false;
        this.worker?.removeEventListener('message', handleMessage);
        this.worker?.removeEventListener('error', handleError);
        reject(error);
      };

      this.worker!.addEventListener('message', handleMessage);
      this.worker!.addEventListener('error', handleError);

      this.worker!.postMessage({
        bFieldSeries,
        dtSeconds,
        resistivityOhmM: SCIENTIFIC_THRESHOLDS.CRUSTAL_RESISTIVITY_OHM_M
      });
    });
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
