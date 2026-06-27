export type PlaceKind = 'airport' | 'city' | 'port';

export type JourneyType = 'drive' | 'fly' | 'sail';

// Backward compatibility alias
export type TransportMode = JourneyType;

export interface Place {
  id: string;            // unique identifier (IATA for airports, slug for cities/ports)
  kind: PlaceKind;
  iata?: string;         // only for airports
  icao?: string;         // only for airports
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  elevation?: number;
  regional?: boolean;
}

export interface PlaceSearchResult {
  place: Place;
  score: number;
  matchField: 'iata' | 'icao' | 'name' | 'city' | 'country';
}

// Backward compatibility alias
export type Airport = Place;
