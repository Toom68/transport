import type { JourneyType } from '@/types/place';
import type { JourneyPhase, PhaseConfig } from '@/types/journey';

// Backward compat alias
export type FlightPhase = JourneyPhase;

/**
 * Ground sequence: fixed REAL-TIME (unscaled) durations that play out at the
 * departure airport before the flight clock starts. The aircraft does not move
 * geographically during these phases — `progress` stays at 0 until takeoff
 * completes (this fixes the old "81 km on the runway" bug where ground phases
 * consumed a fraction of the great-circle route).
 */
// Ground durations per mode (in real seconds)
export const GROUND_DURATIONS_FLY: Record<'BOARDING' | 'TAXI' | 'TAKEOFF', number> = {
  BOARDING: 0,
  TAXI: 5,
  TAKEOFF: 15,
};

export const GROUND_DURATIONS_DRIVE: Record<'BOARDING' | 'DEPARTING', number> = {
  BOARDING: 10, // get in car, start engine
  DEPARTING: 5, // pull out of parking
};

export const GROUND_DURATIONS_SAIL: Record<'BOARDING' | 'DEPARTING', number> = {
  BOARDING: 20, // boarding vessel
  DEPARTING: 40, // undocking, leaving port
};

export const GROUND_DURATIONS = GROUND_DURATIONS_FLY; // backward compat

export const GROUND_TOTAL_SECONDS_FLY =
  GROUND_DURATIONS_FLY.BOARDING + GROUND_DURATIONS_FLY.TAXI + GROUND_DURATIONS_FLY.TAKEOFF;
export const GROUND_TOTAL_SECONDS_DRIVE =
  GROUND_DURATIONS_DRIVE.BOARDING + GROUND_DURATIONS_DRIVE.DEPARTING;
export const GROUND_TOTAL_SECONDS_SAIL =
  GROUND_DURATIONS_SAIL.BOARDING + GROUND_DURATIONS_SAIL.DEPARTING;

export const GROUND_TOTAL_SECONDS = GROUND_TOTAL_SECONDS_FLY; // backward compat

/** Notional in-world time the ground ritual represents (for the day/night clock). */
export const GROUND_WORLD_SECONDS_FLY = 1800; // 30 min
export const GROUND_WORLD_SECONDS_DRIVE = 900; // 15 min
export const GROUND_WORLD_SECONDS_SAIL = 3600; // 60 min
export const GROUND_WORLD_SECONDS = GROUND_WORLD_SECONDS_FLY; // backward compat

// Helper to get ground total seconds for a mode
export function getGroundTotalSeconds(journeyType: JourneyType): number {
  switch (journeyType) {
    case 'fly': return GROUND_TOTAL_SECONDS_FLY;
    case 'drive': return GROUND_TOTAL_SECONDS_DRIVE;
    case 'sail': return GROUND_TOTAL_SECONDS_SAIL;
    default: return GROUND_TOTAL_SECONDS_FLY;
  }
}

export function getGroundWorldSeconds(journeyType: JourneyType): number {
  switch (journeyType) {
    case 'fly': return GROUND_WORLD_SECONDS_FLY;
    case 'drive': return GROUND_WORLD_SECONDS_DRIVE;
    case 'sail': return GROUND_WORLD_SECONDS_SAIL;
    default: return GROUND_WORLD_SECONDS_FLY;
  }
}

/**
 * Airborne phases keyed off airborne progress (0 = start of climb at takeoff
 * completion, 1 = arrival). Ground phases are NOT in this table — they're driven
 * by the real-time ground clock in the flight store.
 */
// Based on a realistic 150-minute flight profile:
// Takeoff 0-5min (0-3.3%), Enroute Climb 5-30min (3.3-20%),
// Cruise 30-120min (20-80%), Descent 120-145min (80-96.7%),
// Approach & Landing 145-150min (96.7-100%)
// Phase configs per mode
export const PHASE_CONFIGS_FLY: PhaseConfig[] = [
  { phase: 'CLIMB', durationFraction: 0.20, altitudeStart: 0, altitudeEnd: 36000, speedKnots: 300, progressStart: 0.00, progressEnd: 0.20 },
  { phase: 'CRUISE', durationFraction: 0.60, altitudeStart: 36000, altitudeEnd: 36000, speedKnots: 300, progressStart: 0.20, progressEnd: 0.80 },
  { phase: 'DESCENT', durationFraction: 0.167, altitudeStart: 36000, altitudeEnd: 10000, speedKnots: 250, progressStart: 0.80, progressEnd: 0.967 },
  { phase: 'APPROACH', durationFraction: 0.022, altitudeStart: 10000, altitudeEnd: 2000, speedKnots: 180, progressStart: 0.967, progressEnd: 0.989 },
  { phase: 'LANDING', durationFraction: 0.011, altitudeStart: 2000, altitudeEnd: 0, speedKnots: 140, progressStart: 0.989, progressEnd: 1.0 },
];

export const PHASE_CONFIGS_DRIVE: PhaseConfig[] = [
  { phase: 'DRIVING', durationFraction: 0.90, altitudeStart: 0, altitudeEnd: 0, speedKnots: 80, progressStart: 0.00, progressEnd: 0.90 },
  { phase: 'ARRIVING', durationFraction: 0.10, altitudeStart: 0, altitudeEnd: 0, speedKnots: 40, progressStart: 0.90, progressEnd: 1.0 },
];

export const PHASE_CONFIGS_SAIL: PhaseConfig[] = [
  { phase: 'SAILING', durationFraction: 0.90, altitudeStart: 0, altitudeEnd: 0, speedKnots: 35, progressStart: 0.00, progressEnd: 0.90 },
  { phase: 'DOCKING', durationFraction: 0.10, altitudeStart: 0, altitudeEnd: 0, speedKnots: 15, progressStart: 0.90, progressEnd: 1.0 },
];

export const PHASE_CONFIGS = PHASE_CONFIGS_FLY; // backward compat

export function getPhaseConfigs(journeyType: JourneyType): PhaseConfig[] {
  switch (journeyType) {
    case 'fly': return PHASE_CONFIGS_FLY;
    case 'drive': return PHASE_CONFIGS_DRIVE;
    case 'sail': return PHASE_CONFIGS_SAIL;
    default: return PHASE_CONFIGS_FLY;
  }
}

/** Resolve the current ground phase from elapsed real seconds, or null once airborne. */
export function getGroundPhase(groundElapsedSeconds: number): JourneyPhase | null {
  return getGroundPhaseForMode(groundElapsedSeconds, 'fly');
}

export function getGroundPhaseForMode(groundElapsedSeconds: number, journeyType: JourneyType): JourneyPhase | null {
  switch (journeyType) {
    case 'fly': {
      if (groundElapsedSeconds < GROUND_DURATIONS_FLY.BOARDING) return 'BOARDING';
      if (groundElapsedSeconds < GROUND_DURATIONS_FLY.BOARDING + GROUND_DURATIONS_FLY.TAXI) return 'TAXI';
      if (groundElapsedSeconds < GROUND_TOTAL_SECONDS_FLY) return 'TAKEOFF';
      return null;
    }
    case 'drive': {
      if (groundElapsedSeconds < GROUND_DURATIONS_DRIVE.BOARDING) return 'BOARDING';
      if (groundElapsedSeconds < GROUND_TOTAL_SECONDS_DRIVE) return 'DEPARTING';
      return null;
    }
    case 'sail': {
      if (groundElapsedSeconds < GROUND_DURATIONS_SAIL.BOARDING) return 'BOARDING';
      if (groundElapsedSeconds < GROUND_TOTAL_SECONDS_SAIL) return 'DEPARTING';
      return null;
    }
    default:
      return null;
  }
}

/** Ground speed (knots) ramp across taxi/takeoff for display. */
export function getGroundSpeed(groundElapsedSeconds: number): number {
  return getGroundSpeedForMode(groundElapsedSeconds, 'fly');
}

export function getGroundSpeedForMode(groundElapsedSeconds: number, journeyType: JourneyType): number {
  const phase = getGroundPhaseForMode(groundElapsedSeconds, journeyType);
  if (phase === 'BOARDING') return 0;
  if (phase === 'TAXI') return 20;
  if (phase === 'TAKEOFF') {
    const takeoffStart = GROUND_DURATIONS_FLY.BOARDING + GROUND_DURATIONS_FLY.TAXI;
    const f = Math.min(1, (groundElapsedSeconds - takeoffStart) / GROUND_DURATIONS_FLY.TAKEOFF);
    return 20 + f * 140;
  }
  if (phase === 'DEPARTING') {
    // Could be driving or sailing - check mode for speed
    if (journeyType === 'drive') {
      const start = GROUND_DURATIONS_DRIVE.BOARDING;
      const f = Math.min(1, (groundElapsedSeconds - start) / GROUND_DURATIONS_DRIVE.DEPARTING);
      return f * 30;
    }
    if (journeyType === 'sail') {
      const start = GROUND_DURATIONS_SAIL.BOARDING;
      const f = Math.min(1, (groundElapsedSeconds - start) / GROUND_DURATIONS_SAIL.DEPARTING);
      return f * 10;
    }
  }
  return 0;
}

/** Airborne phase for the given airborne progress (0..1). */
export function getPhaseForProgress(progress: number): JourneyPhase {
  return getPhaseForProgressAndMode(progress, 'fly');
}

export function getPhaseForProgressAndMode(progress: number, journeyType: JourneyType): JourneyPhase {
  const configs = getPhaseConfigs(journeyType);
  if (progress >= 1) return 'ARRIVED';
  for (let i = configs.length - 1; i >= 0; i--) {
    if (progress >= configs[i].progressStart) {
      return configs[i].phase;
    }
  }
  return configs[0].phase;
}

export function getPhaseConfig(phase: JourneyPhase): PhaseConfig {
  return PHASE_CONFIGS.find(c => c.phase === phase) || PHASE_CONFIGS[0];
}

export function getPhaseConfigForMode(phase: JourneyPhase, journeyType: JourneyType): PhaseConfig {
  const configs = getPhaseConfigs(journeyType);
  return configs.find(c => c.phase === phase) || configs[0];
}

export function getPhaseDescription(phase: JourneyPhase): string {
  switch (phase) {
    case 'BOARDING': return 'Preparing for departure';
    case 'TAXI': return 'Taxiing to runway';
    case 'TAKEOFF': return 'Takeoff';
    case 'CLIMB': return 'Climbing to cruise altitude';
    case 'CRUISE': return 'Cruising';
    case 'DESCENT': return 'Beginning descent';
    case 'APPROACH': return 'On approach';
    case 'LANDING': return 'Landing';
    case 'DEPARTING': return 'Departing';
    case 'DRIVING': return 'Driving';
    case 'ARRIVING': return 'Approaching destination';
    case 'SAILING': return 'Sailing';
    case 'DOCKING': return 'Docking';
    case 'ARRIVED': return 'Arrived at destination';
    default: return 'Unknown phase';
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function formatDistance(km: number): string {
  if (km >= 1000) {
    return `${(km / 1000).toFixed(0)}k km`;
  }
  return `${Math.round(km)} km`;
}
