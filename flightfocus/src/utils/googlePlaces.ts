import type { Place } from '@/types/place';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

export interface GooglePlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

export async function googlePlaceAutocomplete(
  input: string,
  types?: string
): Promise<GooglePlacePrediction[]> {
  if (!GOOGLE_PLACES_KEY || input.trim().length < 2) return [];

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.set('input', input);
  url.searchParams.set('key', GOOGLE_PLACES_KEY);
  if (types) url.searchParams.set('types', types);

  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) return [];
    const data = await resp.json();
    if (data.status !== 'OK' || !data.predictions) return [];

    return data.predictions.map((p: any) => ({
      placeId: p.place_id,
      mainText: p.structured_formatting?.main_text ?? '',
      secondaryText: p.structured_formatting?.secondary_text ?? '',
      description: p.description ?? '',
    }));
  } catch {
    return [];
  }
}

export async function googlePlaceDetails(placeId: string): Promise<Place | null> {
  if (!GOOGLE_PLACES_KEY) return null;

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('key', GOOGLE_PLACES_KEY);
  url.searchParams.set('fields', 'name,formatted_address,geometry,address_components,utc_offset');

  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.status !== 'OK' || !data.result) return null;

    const r = data.result;
    const lat = r.geometry?.location?.lat ?? 0;
    const lng = r.geometry?.location?.lng ?? 0;

    // Extract city and country from address_components
    let city = '';
    let country = '';
    for (const comp of r.address_components ?? []) {
      if (comp.types?.includes('locality') || comp.types?.includes('administrative_area_level_1')) {
        city = city || comp.long_name;
      }
      if (comp.types?.includes('country')) {
        country = comp.long_name;
      }
    }

    // Fallback: use name if no city found
    if (!city) city = r.name ?? '';
    if (!country) country = '';

    // Build timezone from utc_offset (minutes) — approximate
    const utcOffsetMin = r.utc_offset ?? 0;
    const tzHours = Math.round(utcOffsetMin / 60);
    const tzSign = tzHours >= 0 ? '+' : '-';
    const tzAbs = Math.abs(tzHours);
    const timezone = `Etc/GMT${tzSign}${tzAbs}`;

    return {
      id: `google-${placeId}`,
      kind: 'city',
      name: r.name ?? r.formatted_address ?? city,
      city,
      country,
      lat,
      lng,
      timezone,
    };
  } catch {
    return null;
  }
}
