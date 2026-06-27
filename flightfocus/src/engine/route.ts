import type { Place, JourneyType } from '@/types/place';
import type { JourneyRoute, RoutePoint } from '@/types/journey';
import {
  greatCircleDistance,
  initialBearing,
  intermediatePoint,
  estimateDuration,
} from './navigation';
import { fetchDriveRoute, generateDriveRouteSync } from './routing';

export function generateRoute(
  departure: Place,
  arrival: Place,
  journeyType: JourneyType = 'fly',
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

  const duration = estimateDuration(distance, journeyType);

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
    journeyType,
    departure,
    arrival,
    distance,
    duration,
    bearing,
    points,
  };
}

// Backward-compatible alias
export function generateFlightRoute(
  departure: Place,
  arrival: Place,
  numPoints: number = 200
): JourneyRoute {
  return generateRoute(departure, arrival, 'fly', numPoints);
}

/**
 * Async route generation. For drive mode, tries Mapbox Directions API first,
 * falls back to great-circle. For fly/sail, uses sync great-circle.
 */
export async function generateRouteAsync(
  departure: Place,
  arrival: Place,
  journeyType: JourneyType = 'fly',
  mapboxToken?: string
): Promise<JourneyRoute> {
  if (journeyType === 'drive') {
    if (mapboxToken) {
      const driveRoute = await fetchDriveRoute(departure, arrival, mapboxToken);
      if (driveRoute) return driveRoute;
    }
    return generateDriveRouteSync(departure, arrival);
  }
  return generateRoute(departure, arrival, journeyType);
}

export function getPositionAtProgress(
  route: JourneyRoute,
  progress: number
): RoutePoint {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const index = Math.min(
    Math.floor(clampedProgress * (route.points.length - 1)),
    route.points.length - 2
  );

  const p1 = route.points[index];
  const p2 = route.points[index + 1];

  const segmentProgress =
    (clampedProgress - p1.progress) / (p2.progress - p1.progress || 1);

  return {
    lat: p1.lat + (p2.lat - p1.lat) * segmentProgress,
    lng: p1.lng + (p2.lng - p1.lng) * segmentProgress,
    distanceFromStart: p1.distanceFromStart + (p2.distanceFromStart - p1.distanceFromStart) * segmentProgress,
    bearing: p1.bearing + (p2.bearing - p1.bearing) * segmentProgress,
    progress: clampedProgress,
  };
}
