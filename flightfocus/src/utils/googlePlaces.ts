import type { Place } from '@/types/place';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

export interface GooglePlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

// Lazy-load the Google Maps JavaScript API with Places library
let mapsPromise: Promise<typeof google> | null = null;

declare global {
  interface Window { google: typeof google; }
}

function loadGoogleMaps(): Promise<typeof google> {
  if (mapsPromise) return mapsPromise;
  if (typeof google !== 'undefined' && google.maps) {
    mapsPromise = Promise.resolve(google);
    return mapsPromise;
  }

  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_KEY}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (typeof google !== 'undefined' && google.maps) {
        resolve(google);
      } else {
        reject(new Error('Google Maps failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Google Maps script load error'));
    document.head.appendChild(script);
  });

  return mapsPromise;
}

export async function googlePlaceAutocomplete(
  input: string,
  types?: string
): Promise<GooglePlacePrediction[]> {
  if (!GOOGLE_PLACES_KEY || input.trim().length < 2) return [];

  try {
    const g = await loadGoogleMaps();
    const service = new g.maps.places.AutocompleteService();

    const predictions = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
      service.getPlacePredictions(
        {
          input,
          types: types ? [types] : undefined,
        },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            resolve(results);
          } else {
            resolve([]);
          }
        }
      );
    });

    return predictions.map((p: any) => ({
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

  try {
    const g = await loadGoogleMaps();

    // PlacesService requires a map or div element
    let container = document.getElementById('google-places-helper') as HTMLDivElement | null;
    if (!container) {
      container = document.createElement('div');
      container.id = 'google-places-helper';
      container.style.display = 'none';
      document.body.appendChild(container);
    }

    const service = new g.maps.places.PlacesService(container);

    const result = await new Promise<google.maps.places.PlaceResult | null>((resolve) => {
      service.getDetails(
        {
          placeId,
          fields: ['name', 'formatted_address', 'geometry', 'address_components', 'utc_offset'],
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            resolve(place);
          } else {
            resolve(null);
          }
        }
      );
    });

    if (!result) return null;

    const lat = result.geometry?.location?.lat() ?? 0;
    const lng = result.geometry?.location?.lng() ?? 0;

    let city = '';
    let country = '';
    for (const comp of result.address_components ?? []) {
      if (comp.types?.includes('locality') || comp.types?.includes('administrative_area_level_1')) {
        city = city || comp.long_name;
      }
      if (comp.types?.includes('country')) {
        country = comp.long_name;
      }
    }

    if (!city) city = result.name ?? '';
    if (!country) country = '';

    const utcOffsetMin = result.utc_offset ?? 0;
    const tzHours = Math.round(utcOffsetMin / 60);
    const tzSign = tzHours >= 0 ? '+' : '-';
    const tzAbs = Math.abs(tzHours);
    const timezone = `Etc/GMT${tzSign}${tzAbs}`;

    return {
      id: `google-${placeId}`,
      kind: 'city',
      name: result.name ?? result.formatted_address ?? city,
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
