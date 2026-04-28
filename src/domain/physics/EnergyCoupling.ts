// Implements Newell Coupling Function for Solar Wind-Magnetosphere Energy Transfer

export interface SolarWindData {
  v: number;  // Solar wind speed (km/s)
  by: number; // IMF By component (nT)
  bz: number; // IMF Bz component (nT)
}

export class EnergyCoupling {
  /**
   * Calculates the Newell Coupling Function (dPhi/dt)
   * Formula: dPhi/dt = v^(4/3) * B_T^(2/3) * sin(theta_c / 2)^(8/3)
   * Where B_T = sqrt(By^2 + Bz^2) and theta_c = atan2(By, Bz)
   * 
   * Returns a scalar representing the rate of magnetic flux opening.
   */
  public calculateNewellCoupling(data: SolarWindData): number {
    const { v, by, bz } = data;

    // Transverse magnetic field
    const bt = Math.sqrt(by * by + bz * bz);
    
    // Clock angle
    // Standard definition: arctan(By/Bz) with adjustments for quadrants
    const theta_c = Math.atan2(by, bz);
    
    // Half clock angle
    const sinHalfTheta = Math.sin(theta_c / 2.0);
    
    // Components
    const termV = Math.pow(v, 4.0 / 3.0);
    const termB = Math.pow(bt, 2.0 / 3.0);
    const termTheta = Math.pow(Math.abs(sinHalfTheta), 8.0 / 3.0);

    return termV * termB * termTheta;
  }

  /**
   * Estimates Kp index purely based on empirical correlation with Newell coupling.
   * This is a simplified linear mapping for visualization purposes.
   */
  public estimateKpFromCoupling(couplingValue: number): number {
    // Empirical baseline: very low coupling = Kp ~ 0-1. High coupling = Kp 7-9.
    // Assuming coupling ranges roughly from 0 to 10000+ in extreme events.
    const baseline = 1.0;
    const scaling = 0.0005;
    const estimatedKp = baseline + couplingValue * scaling;
    
    // Kp is bounded between 0 and 9
    return Math.max(0, Math.min(9, estimatedKp));
  }
}
