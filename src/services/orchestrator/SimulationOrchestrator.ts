// AI-Driven Simulation Orchestrator for Sudden Impulse Detection

import { SCIENTIFIC_THRESHOLDS } from '../../config/thresholds';
import type { SolarWindObservation } from '../data/DataAssimilationEngine';

type OrchestratorState = 'NORMAL' | 'SEVERE_STORM' | 'RECOVERY';

export class SimulationOrchestrator {
  private history: SolarWindObservation[] = [];
  private state: OrchestratorState = 'NORMAL';
  private recoveryStartTime: number | null = null;
  
  // Custom event to broadcast state changes
  private EventTarget = new EventTarget();

  /**
   * Feed a new observation into the agent. The agent will assess for anomalies.
   */
  public ingestObservation(obs: SolarWindObservation) {
    this.history.push(obs);
    
    // Keep only the last 15 minutes of data (assuming 1-min cadence = 15 items max)
    // We only strictly need 5 minutes, but a short buffer is good.
    const cutoffTime = obs.timestamp - (15 * 60 * 1000);
    this.history = this.history.filter(d => d.timestamp >= cutoffTime);

    this.analyzeSuddenImpulse(obs);
  }

  /**
   * Detects if Bz drops more than the threshold in a 5-minute window.
   */
  private analyzeSuddenImpulse(latestObs: SolarWindObservation) {
    const fiveMinsAgo = latestObs.timestamp - (5 * 60 * 1000);
    
    // Find observation closest to 5 minutes ago
    let pastObs: SolarWindObservation | null = null;
    for (const obs of this.history) {
      if (obs.timestamp <= fiveMinsAgo) {
        pastObs = obs;
      } else {
        break; // history is assumed to be sorted chronologically
      }
    }

    if (!pastObs) return;

    const bzDrop = pastObs.bz - latestObs.bz;

    if (bzDrop >= SCIENTIFIC_THRESHOLDS.SUDDEN_IMPULSE_BZ_DROP) {
      if (this.state !== 'SEVERE_STORM') {
        this.transitionState('SEVERE_STORM');
      }
    } else {
      if (this.state === 'SEVERE_STORM' && latestObs.bz > -5) {
        // Start hysteresis/recovery
        this.recoveryStartTime = latestObs.timestamp;
        this.transitionState('RECOVERY');
      }
    }

    if (this.state === 'RECOVERY' && this.recoveryStartTime) {
      if (latestObs.bz <= -5) {
        // Relapse into storm
        this.recoveryStartTime = null;
        this.transitionState('SEVERE_STORM');
      } else {
        const elapsedMs = latestObs.timestamp - this.recoveryStartTime;
        const recoveryDurationMs = 15 * 60 * 1000; // 15 minutes simulated time

        if (elapsedMs >= recoveryDurationMs) {
          this.recoveryStartTime = null;
          this.transitionState('NORMAL');
        } else {
          // Broadcast diminishing intensity during recovery
          const intensity = 1 - (elapsedMs / recoveryDurationMs);
          this.EventTarget.dispatchEvent(new CustomEvent('scenario-change', {
            detail: { state: 'RECOVERY', recoveryProgress: intensity }
          }));
        }
      }
    }
  }

  private transitionState(newState: OrchestratorState) {
    this.state = newState;
    console.warn(`[SimulationOrchestrator] Transitioning to ${newState} protocol.`);
    
    // Broadcast event for UI and KinematicsEngine to react
    this.EventTarget.dispatchEvent(new CustomEvent('scenario-change', { 
      detail: { state: newState } 
    }));
  }

  /**
   * Subscribe to state changes.
   */
  public onStateChange(callback: (state: OrchestratorState) => void) {
    const listener = (e: Event) => {
      callback((e as CustomEvent).detail.state);
    };
    this.EventTarget.addEventListener('scenario-change', listener);
    return () => this.EventTarget.removeEventListener('scenario-change', listener);
  }

  public getState(): OrchestratorState {
    return this.state;
  }
}
