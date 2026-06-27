import type { JourneyType } from '@/types/place';

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_NM = 3440.065;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function greatCircleDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function greatCircleDistanceNm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}

export function initialBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function intermediatePoint(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  fraction: number
): { lat: number; lng: number } {
  const φ1 = toRad(lat1);
  const λ1 = toRad(lng1);
  const φ2 = toRad(lat2);
  const λ2 = toRad(lng2);

  const Δφ = φ2 - φ1;
  const Δλ = λ2 - λ1;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const δ = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const A = Math.sin((1 - fraction) * δ) / Math.sin(δ);
  const B = Math.sin(fraction * δ) / Math.sin(δ);

  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);

  const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
  const lng = toDeg(Math.atan2(y, x));

  return { lat, lng };
}

export function generateRoutePoints(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  numPoints: number = 100
): { lat: number; lng: number; progress: number }[] {
  const points: { lat: number; lng: number; progress: number }[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    const point = intermediatePoint(lat1, lng1, lat2, lng2, fraction);
    points.push({ ...point, progress: fraction });
  }

  return points;
}

// Airborne flight time only (taxi/takeoff are a separate fixed ground sequence,
// so they no longer consume flight time or great-circle distance).
export function estimateFlightDuration(distanceKm: number): number {
  const cruiseSpeedKmh = 870;
  const climbTimeMin = 20;
  const descentTimeMin = 25;

  const cruiseDistanceKm = Math.max(0, distanceKm - 200);
  const cruiseTimeMin = (cruiseDistanceKm / cruiseSpeedKmh) * 60;

  return (climbTimeMin + cruiseTimeMin + descentTimeMin) * 60;
}

// Estimate driving duration: average 80 km/h with some overhead for stops/traffic
export function estimateDriveDuration(distanceKm: number): number {
  const avgSpeedKmh = 80;
  const overheadMin = 5;
  return ((distanceKm / avgSpeedKmh) * 60 + overheadMin) * 60;
}

// Estimate sailing duration: average 35 km/h (about 19 knots for a ferry/cargo vessel)
export function estimateSailDuration(distanceKm: number): number {
  const avgSpeedKmh = 35;
  const overheadMin = 30;
  return ((distanceKm / avgSpeedKmh) * 60 + overheadMin) * 60;
}

// Generic duration estimator that picks the right function based on mode
export function estimateDuration(distanceKm: number, journeyType: JourneyType): number {
  switch (journeyType) {
    case 'fly': return estimateFlightDuration(distanceKm);
    case 'drive': return estimateDriveDuration(distanceKm);
    case 'sail': return estimateSailDuration(distanceKm);
    default: return estimateFlightDuration(distanceKm);
  }
}

// Altitude keyed off AIRBORNE progress (0 = start of climb, 1 = arrival).
// Based on a realistic 150-minute flight profile:
// Takeoff 0-5min (0-3.3%): rapid climb from 0 to ~10,000ft
// Enroute Climb 5-30min (3.3-20%): steady climb 10,000 -> 36,000ft
// Cruise 30-120min (20-80%): flat at 36,000ft
// Descent 120-145min (80-96.7%): controlled descent 36,000 -> 10,000ft
// Approach 145-148min (96.7-98.9%): 10,000 -> 2,000ft
// Landing 148-150min (98.9-100%): 2,000 -> 0ft
export function getAltitudeForProgress(progress: number): number {
  const cruiseAltitudeFt = 36000;

  if (progress <= 0) return 0;
  // TAKEOFF: 0 -> 0.033, rapid climb 0 -> 10,000ft (steep)
  if (progress < 0.033) return (progress / 0.033) * 10000;
  // ENROUTE CLIMB: 0.033 -> 0.20, steady climb 10,000 -> 36,000ft
  if (progress < 0.20) return 10000 + ((progress - 0.033) / 0.167) * 26000;
  // CRUISE: 0.20 -> 0.80, flat at 36,000ft
  if (progress < 0.80) return cruiseAltitudeFt;
  // DESCENT: 0.80 -> 0.967, controlled descent 36,000 -> 10,000ft
  if (progress < 0.967) return cruiseAltitudeFt - ((progress - 0.80) / 0.167) * 26000;
  // APPROACH: 0.967 -> 0.989, 10,000 -> 2,000ft
  if (progress < 0.989) return 10000 - ((progress - 0.967) / 0.022) * 8000;
  // LANDING: 0.989 -> 1.0, 2,000 -> 0ft
  if (progress < 1) return 2000 * (1 - (progress - 0.989) / 0.011);
  return 0;
}

// Speed (knots) keyed off AIRBORNE progress.
// Based on a realistic 150-minute flight profile:
// Takeoff: 0 -> 250 kts (rapid acceleration on runway, hold 250 below 10k)
// Enroute Climb: 250 -> 300 kts (step up after clearing lower airspace)
// Cruise: 300 kts indicated airspeed (flat)
// Descent: 300 -> 250 kts (step down to 250 below 10k)
// Approach: 250 -> 140 kts (gradual decel for landing)
// Landing: 140 -> 0 kts (braking to stop)
export function getSpeedForProgress(progress: number): number {
  if (progress <= 0) return 160;
  // TAKEOFF: 0 -> 0.033, accelerate 160 -> 250 kts
  if (progress < 0.033) return 160 + (progress / 0.033) * 90;
  // ENROUTE CLIMB: 0.033 -> 0.20, 250 -> 300 kts
  if (progress < 0.20) return 250 + ((progress - 0.033) / 0.167) * 50;
  // CRUISE: 0.20 -> 0.80, 300 kts indicated
  if (progress < 0.80) return 300;
  // DESCENT: 0.80 -> 0.967, 300 -> 250 kts (braking with thicker air below 10k)
  if (progress < 0.967) return 300 - ((progress - 0.80) / 0.167) * 50;
  // APPROACH: 0.967 -> 0.989, 250 -> 140 kts
  if (progress < 0.989) return 250 - ((progress - 0.967) / 0.022) * 110;
  // LANDING: 0.989 -> 1.0, 140 -> 0 kts (braking to stop)
  if (progress < 1) return 140 * (1 - (progress - 0.989) / 0.011);
  return 0;
}

// Speed (km/h) for driving mode - simpler profile
export function getDriveSpeedForProgress(progress: number): number {
  if (progress <= 0) return 0;
  if (progress < 0.05) return (progress / 0.05) * 80;
  if (progress < 0.90) return 80 + Math.sin(progress * Math.PI * 4) * 5;
  if (progress < 0.97) return 80 - ((progress - 0.90) / 0.07) * 40;
  if (progress < 1) return 40 * (1 - (progress - 0.97) / 0.03);
  return 0;
}

// Speed (km/h) for sailing mode
export function getSailSpeedForProgress(progress: number): number {
  if (progress <= 0) return 0;
  if (progress < 0.05) return (progress / 0.05) * 35;
  if (progress < 0.90) return 35 + Math.sin(progress * Math.PI * 3) * 3;
  if (progress < 0.97) return 35 - ((progress - 0.90) / 0.07) * 20;
  if (progress < 1) return 15 * (1 - (progress - 0.97) / 0.03);
  return 0;
}

// Altitude for driving mode (always 0)
export function getDriveAltitudeForProgress(_progress: number): number {
  return 0;
}

// Altitude for sailing mode (always 0 - sea level)
export function getSailAltitudeForProgress(_progress: number): number {
  return 0;
}

// Generic speed getter based on mode (returns knots for fly, km/h for drive/sail)
export function getSpeedForMode(progress: number, journeyType: JourneyType): number {
  switch (journeyType) {
    case 'fly': return getSpeedForProgress(progress);
    case 'drive': return getDriveSpeedForProgress(progress);
    case 'sail': return getSailSpeedForProgress(progress);
    default: return getSpeedForProgress(progress);
  }
}

// Generic altitude getter based on mode (returns feet)
export function getAltitudeForMode(progress: number, journeyType: JourneyType): number {
  switch (journeyType) {
    case 'fly': return getAltitudeForProgress(progress);
    case 'drive': return getDriveAltitudeForProgress(progress);
    case 'sail': return getSailAltitudeForProgress(progress);
    default: return getAltitudeForProgress(progress);
  }
}
