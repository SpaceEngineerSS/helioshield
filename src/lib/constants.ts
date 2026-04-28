// Implements SI Physical Constants for Helioshield Kinematics & Coupling

/**
 * Constants used across the simulation engine.
 * Defined strictly in SI Units unless otherwise specified.
 */
export const PHYSICS_CONSTANTS = {
  // Mass of a proton (kg)
  PROTON_MASS: 1.67262192e-27,
  
  // Magnetic permeability of free space (T*m/A)
  MU_0: 4 * Math.PI * 1e-7,
  
  // Earth Radius in meters (m)
  EARTH_RADIUS_M: 6371000,
  
  // Earth Radius in kilometers (km)
  EARTH_RADIUS_KM: 6371,

  // Distance from L1 point to Earth (meters)
  // L1 is approximately 1.5 million km from Earth
  L1_DISTANCE_M: 1.5e9,

  // Distance from L1 point to Earth (km)
  L1_DISTANCE_KM: 1.5e6,
  
  // Speed of Light in a vacuum (m/s)
  C: 299792458,
  
  // Standard solar wind background speed (m/s) - ~400 km/s
  BACKGROUND_SOLAR_WIND_SPEED: 400000,

  // Average interplanetary magnetic field (T) - ~5 nT
  B_0_NOMINAL: 5e-9,
  
  // Runge-Kutta numerical solver tolerance
  RK4_TOLERANCE: 1e-6
} as const;
