// Test suite for simulating extreme historical space weather events

import { describe, it, expect } from 'vitest';
import { KinematicsEngine } from '../domain/physics/KinematicsEngine';
import { EnergyCoupling } from '../domain/physics/EnergyCoupling';

describe('Historical Extreme Events Validation', () => {

  describe('Carrington Event (1859)', () => {
    it('should calculate extreme CME transit time matching historical ~17.6 hours', () => {
      const engine = new KinematicsEngine();
      
      // Carrington CME was estimated at >2500 km/s initially.
      // With background solar wind around 400 km/s and typical gamma
      const initialSpeedMps = 2800 * 1000; // 2800 km/s to m/s
      const params = {
        w: 400 * 1000, 
        gamma: 0.2e-7 // Empirical drag parameter for fast CME
      };

      const result = engine.simulateTransitToEarth(initialSpeedMps, params);
      const transitHours = result.transitTime / 3600;

      // Real event was ~17.6 hours. The kinematic model should be close.
      expect(transitHours).toBeGreaterThan(12);
      expect(transitHours).toBeLessThan(24);
    });

    it('should generate extreme Newell coupling values predicting Kp 9', () => {
      const coupling = new EnergyCoupling();
      
      // Carrington Event estimated Bz could have been -50 nT to -100 nT
      const data = {
        v: 2000, // km/s
        by: 0,
        bz: -80  // Strong southward IMF
      };

      const dPhiDt = coupling.calculateNewellCoupling(data);
      
      // Extreme values should result in massive coupling
      expect(dPhiDt).toBeGreaterThan(10000);

      const estimatedKp = coupling.estimateKpFromCoupling(dPhiDt);
      expect(estimatedKp).toBe(9); // Max Kp scale is 9
    });
  });

  describe('Halloween Storms (2003)', () => {
    it('should accurately calculate Halloween Storm coupling metrics', () => {
      const coupling = new EnergyCoupling();
      
      // Halloween 2003 peak params: V ~1800 km/s, Bz ~-50 nT
      const data = {
        v: 1800,
        by: 10,
        bz: -50
      };

      const dPhiDt = coupling.calculateNewellCoupling(data);
      const estimatedKp = coupling.estimateKpFromCoupling(dPhiDt);
      
      expect(estimatedKp).toBe(9);
    });
  });
});
