// Implements Vršnak-DBM RK4 step with adaptive tolerance

import { PHYSICS_CONSTANTS } from '../../lib/constants';

export interface DBMState {
  x: number; // Position (m)
  v: number; // Velocity (m/s)
}

export interface DBMParams {
  w: number;     // Background solar wind speed (m/s)
  gamma: number; // Drag parameter (1/m)
}

export class KinematicsEngine {
  private tolerance = PHYSICS_CONSTANTS.RK4_TOLERANCE; // 1e-6

  /**
   * Calculates the acceleration based on the Drag-Based Model (DBM)
   * Equation: a = -gamma * (v - w) * |v - w|
   */
  private computeAcceleration(v: number, params: DBMParams): number {
    const { w, gamma } = params;
    return -gamma * (v - w) * Math.abs(v - w);
  }

  /**
   * Standard 4th-Order Runge-Kutta step
   */
  private rk4Step(state: DBMState, dt: number, params: DBMParams): DBMState {
    const { x, v } = state;

    // k1
    const k1x = v;
    const k1v = this.computeAcceleration(v, params);

    // k2
    const v2 = v + 0.5 * dt * k1v;
    const k2x = v2;
    const k2v = this.computeAcceleration(v2, params);

    // k3
    const v3 = v + 0.5 * dt * k2v;
    const k3x = v3;
    const k3v = this.computeAcceleration(v3, params);

    // k4
    const v4 = v + dt * k3v;
    const k4x = v4;
    const k4v = this.computeAcceleration(v4, params);

    return {
      x: x + (dt / 6.0) * (k1x + 2 * k2x + 2 * k3x + k4x),
      v: v + (dt / 6.0) * (k1v + 2 * k2v + 2 * k3v + k4v),
    };
  }

  /**
   * Advances the simulation using an adaptive RK4 strategy to meet the 10^-6 tolerance.
   */
  public stepAdaptive(state: DBMState, dt: number, params: DBMParams): DBMState {
    let currentDt = dt;
    let currentState = { ...state };
    let timeRemaining = dt;

    while (timeRemaining > 0) {
      // Perform one full step
      const stepFull = this.rk4Step(currentState, currentDt, params);

      // Perform two half steps
      const halfDt = currentDt / 2;
      const stepHalf1 = this.rk4Step(currentState, halfDt, params);
      const stepHalf2 = this.rk4Step(stepHalf1, halfDt, params);

      // Calculate error estimate (using position error)
      const error = Math.abs(stepFull.x - stepHalf2.x) / 15.0; // Richardson extrapolation factor

      if (error <= this.tolerance) {
        // Step succeeded
        currentState = stepHalf2;
        timeRemaining -= currentDt;
        // Optionally increase step size for next iteration if error is very small
        if (error < this.tolerance / 10) {
          currentDt = Math.min(currentDt * 1.5, timeRemaining);
        } else {
          currentDt = Math.min(currentDt, timeRemaining);
        }
      } else {
        // Step failed, reduce step size
        currentDt *= 0.5;
      }
    }

    return currentState;
  }

  /**
   * Propagate a CME from Sun to Earth (L1) and return transit time and impact speed.
   */
  public simulateTransitToEarth(initialSpeed: number, params: DBMParams): { transitTime: number; impactSpeed: number } {
    let state: DBMState = { x: PHYSICS_CONSTANTS.EARTH_RADIUS_M, v: initialSpeed }; // Start at Sun surface
    let time = 0;
    const dt = 3600; // 1 hour initial step size

    const targetDistance = PHYSICS_CONSTANTS.L1_DISTANCE_M;

    while (state.x < targetDistance && time < 86400 * 10) { // Max 10 days
      state = this.stepAdaptive(state, dt, params);
      time += dt;
    }

    return { transitTime: time, impactSpeed: state.v };
  }
}
