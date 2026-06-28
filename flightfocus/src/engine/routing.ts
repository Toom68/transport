import type { Place } from '@/types/place';
import type { JourneyRoute, RoutePoint } from '@/types/journey';
import {
  greatCircleDistance,
  initialBearing,
  intermediatePoint,
  estimateDuration,
} from './navigation';

interface MapboxDirectionsResponse {
  routes: Array<{
    geometry: {
      coordinates: [number, number][]; // [lng, lat] pairs
    };
    distance: number; // meters
    duration: number; // seconds
  }>;
  code: string;
  message?: string;
}

/**
 * Fetch a real driving route from Mapbox Directions API.
 * Returns null on any error — caller should fall back to great-circle.
 */
export async function fetchDriveRoute(
  departure: Place,
  arrival: Place,
  token: string
): Promise<JourneyRoute | null> {
  if (!token) return null;

  const coords = `${departure.lng},${departure.lat};${arrival.lng},${arrival.lat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&steps=false&access_token=${token}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;

    const data = (await resp.json()) as MapboxDirectionsResponse;
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    const rawCoords = route.geometry.coordinates;
    if (!rawCoords || rawCoords.length < 2) return null;

    // Downsample to preserve road detail on winding routes.
    // Scale max points with distance: ~1 point per 2km, clamped 500–2000.
    const distanceKm = route.distance / 1000;
    const maxPoints = Math.min(2000, Math.max(500, Math.ceil(distanceKm / 2)));
    const step = Math.max(1, Math.ceil(rawCoords.length / maxPoints));
    const sampled: [number, number][] = [];
    for (let i = 0; i < rawCoords.length; i += step) {
      sampled.push(rawCoords[i]);
    }
    // Always include the final coordinate
    if (sampled[sampled.length - 1] !== rawCoords[rawCoords.length - 1]) {
      sampled.push(rawCoords[rawCoords.length - 1]);
    }

    const durationSec = route.duration;

    // Build RoutePoints with progress, bearing, distanceFromStart
    const points: RoutePoint[] = [];
    let cumulativeDistance = 0;

    for (let i = 0; i < sampled.length; i++) {
      const [lng, lat] = sampled[i];
      const progress = i / (sampled.length - 1);

      let pointBearing = 0;
      let segDistance = 0;

      if (i < sampled.length - 1) {
        const [nextLng, nextLat] = sampled[i + 1];
        pointBearing = initialBearing(lat, lng, nextLat, nextLng);
        segDistance = greatCircleDistance(lat, lng, nextLat, nextLng);
      } else if (i > 0) {
        const [prevLng, prevLat] = sampled[i - 1];
        pointBearing = initialBearing(prevLat, prevLng, lat, lng);
      }

      const distanceFromStart = cumulativeDistance;

      points.push({
        lat,
        lng,
        distanceFromStart,
        bearing: pointBearing,
        progress,
      });

      cumulativeDistance += segDistance;
    }

    // Use API duration if reasonable, otherwise estimate
    const duration = durationSec > 0 ? durationSec : estimateDuration(distanceKm, 'drive');

    const bearing = points.length > 0 ? points[0].bearing : initialBearing(
      departure.lat, departure.lng, arrival.lat, arrival.lng
    );

    return {
      journeyType: 'drive',
      departure,
      arrival,
      distance: distanceKm,
      duration,
      bearing,
      points,
    };
  } catch {
    return null;
  }
}

/**
 * Synchronous great-circle fallback for drive mode.
 * Uses the same logic as generateRoute but with drive-specific duration.
 */
export function generateDriveRouteSync(
  departure: Place,
  arrival: Place,
  numPoints: number = 200
): JourneyRoute {
  const distance = greatCircleDistance(
    departure.lat,
    departure.lng,
    arrival.lat,
    arrival.lng
  );

  const bearing = initialBearing(
    departure.lat,
    departure.lng,
    arrival.lat,
    arrival.lng
  );

  const duration = estimateDuration(distance, 'drive');

  const points: RoutePoint[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const progress = i / numPoints;
    const point = intermediatePoint(
      departure.lat,
      departure.lng,
      arrival.lat,
      arrival.lng,
      progress
    );

    const distanceFromStart = distance * progress;

    let pointBearing = bearing;
    if (i < numPoints) {
      const nextPoint = intermediatePoint(
        departure.lat,
        departure.lng,
        arrival.lat,
        arrival.lng,
        (i + 1) / numPoints
      );
      pointBearing = initialBearing(point.lat, point.lng, nextPoint.lat, nextPoint.lng);
    }

    points.push({
      lat: point.lat,
      lng: point.lng,
      distanceFromStart,
      bearing: pointBearing,
      progress,
    });
  }

  return {
    journeyType: 'drive',
    departure,
    arrival,
    distance,
    duration,
    bearing,
    points,
  };
}
