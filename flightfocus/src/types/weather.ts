export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy_rain'
  | 'snow'
  | 'thunderstorm';

export interface WeatherData {
  condition: WeatherCondition;
  temperatureC: number;
  windSpeedKmh: number;
  windDirection: number;
  humidity: number;
  cloudCover: number; // 0..1
  visibilityKm: number;
  isFetching: boolean;
  fetchedAt: number | null;
  stationName: string;
}

export function createDefaultWeather(): WeatherData {
  return {
    condition: 'clear',
    temperatureC: 15,
    windSpeedKmh: 10,
    windDirection: 0,
    humidity: 50,
    cloudCover: 0,
    visibilityKm: 10,
    isFetching: false,
    fetchedAt: null,
    stationName: '',
  };
}

// Maps WMO weather codes (Open-Meteo) to our condition enum.
export function wmoCodeToCondition(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly_cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 65) return 'rain';
  if (code >= 66 && code <= 67) return 'rain'; // freezing rain
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return code === 82 ? 'heavy_rain' : 'rain';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  return 'cloudy';
}

// Whether the condition implies rain on the window.
export function isRaining(condition: WeatherCondition): boolean {
  return (
    condition === 'drizzle' ||
    condition === 'rain' ||
    condition === 'heavy_rain' ||
    condition === 'thunderstorm'
  );
}

// Whether the condition implies heavy cloud cover.
export function isOvercast(condition: WeatherCondition): boolean {
  return condition === 'overcast' || condition === 'fog' || condition === 'thunderstorm';
}

// Cloud density multiplier for the sky engine (0..1).
export function cloudDensity(condition: WeatherCondition): number {
  switch (condition) {
    case 'clear': return 0.05;
    case 'partly_cloudy': return 0.35;
    case 'cloudy': return 0.6;
    case 'overcast': return 0.9;
    case 'fog': return 0.95;
    case 'drizzle': return 0.75;
    case 'rain': return 0.85;
    case 'heavy_rain': return 0.95;
    case 'snow': return 0.85;
    case 'thunderstorm': return 1.0;
    default: return 0.3;
  }
}
