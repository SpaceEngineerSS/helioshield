/** Physical constants used across the models. Units are in the names. */

export const AU_KM = 149_597_870.7;
export const SOLAR_RADIUS_KM = 695_700;
export const EARTH_RADIUS_KM = 6_371;
/** Mean Sun–Earth L1 distance from Earth. */
export const L1_DISTANCE_KM = 1_500_000;
/** Proton mass × 1e6 (cm⁻³ → m⁻³) × 1e6 (km² → m²) × 1e9 (Pa → nPa). */
export const DYN_PRESSURE_COEFF = 1.6726e-6;

/**
 * Centred-dipole north pole, IGRF-14 epoch 2025.
 * Good enough for aurora view lines; it is not AACGM.
 */
export const DIPOLE_POLE_LAT_DEG = 80.8;
export const DIPOLE_POLE_LON_DEG = -72.8;

export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;
