import type { Place } from '@/types/place';

interface MapboxGeocodingFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
  context?: Array<{ id: string; text: string }>;
}

interface MapboxGeocodingResponse {
  features: MapboxGeocodingFeature[];
  type: string;
}

/**
 * Search places worldwide using the Mapbox Geocoding API.
 * Returns Place objects compatible with the app's place system.
 */
export async function searchMapboxPlaces(
  query: string,
  token: string,
  limit: number = 6
): Promise<Place[]> {
  if (!query || query.trim().length < 2 || !token) return [];

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=${limit}&types=place,address,poi,locality,neighborhood`;

    const resp = await fetch(url);
    if (!resp.ok) return [];

    const data = (await resp.json()) as MapboxGeocodingResponse;
    if (!data.features || data.features.length === 0) return [];

    return data.features.map((feature) => mapboxFeatureToPlace(feature));
  } catch {
    return [];
  }
}

/**
 * Reverse geocode: get a place name from lat/lng coordinates.
 * Uses Mapbox Geocoding API.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  token: string
): Promise<Place | null> {
  if (!token) return null;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&types=place,address,poi,locality,neighborhood`;

    const resp = await fetch(url);
    if (!resp.ok) return null;

    const data = (await resp.json()) as MapboxGeocodingResponse;
    if (!data.features || data.features.length === 0) return null;

    return mapboxFeatureToPlace(data.features[0]);
  } catch {
    return null;
  }
}

function mapboxFeatureToPlace(feature: MapboxGeocodingFeature): Place {
  const [lng, lat] = feature.center;

  // Extract city, country from context
  let city = feature.text;
  let country = '';

  if (feature.context) {
    for (const ctx of feature.context) {
      if (ctx.id.startsWith('country')) {
        country = ctx.text;
      } else if (ctx.id.startsWith('place') && !city) {
        city = ctx.text;
      }
    }
  }

  // Determine kind based on place_type
  const placeType = feature.place_type[0] ?? 'place';
  let kind: Place['kind'] = 'city';
  if (placeType === 'poi') kind = 'city'; // points of interest treated as cities for driving
  if (placeType === 'address') kind = 'city';

  // Generate a unique ID
  const id = `mapbox-${feature.id}`;

  // Try to infer timezone from coordinates (rough approximation)
  const timezone = inferTimezone(lat, lng);

  return {
    id,
    kind,
    name: feature.text,
    city,
    country,
    lat,
    lng,
    timezone,
  };
}

/**
 * Rough timezone inference from coordinates.
 * This is a simplified approximation — for production, use a proper tz lookup.
 */
function inferTimezone(lat: number, lng: number): string {
  const offsetHours = Math.round(lng / 15);
  const sign = offsetHours >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetHours);
  const hours = String(absOffset).padStart(2, '0');
  return `Etc/GMT${sign}${hours}`;
}
