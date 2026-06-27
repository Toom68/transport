export interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  elevation?: number;
  regional?: boolean; // true for smaller/regional airports (smaller map dot)
}

export interface AirportSearchResult {
  airport: Airport;
  score: number;
  matchField: 'iata' | 'icao' | 'name' | 'city' | 'country';
}
