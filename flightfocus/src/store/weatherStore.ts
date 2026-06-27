import { create } from 'zustand';
import type { WeatherData, WeatherCondition } from '@/types/weather';
import { createDefaultWeather, wmoCodeToCondition } from '@/types/weather';

interface WeatherStore extends WeatherData {
  fetchWeather: (lat: number, lng: number) => Promise<void>;
  setCondition: (condition: WeatherCondition) => void;
  reset: () => void;
}

export const useWeatherStore = create<WeatherStore>((set, get) => ({
  ...createDefaultWeather(),

  fetchWeather: async (lat, lng) => {
    if (get().isFetching) return;
    set({ isFetching: true });

    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,visibility`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
      const data = await res.json();

      const current = data.current;
      if (!current) throw new Error('No current weather in response');

      set({
        condition: wmoCodeToCondition(current.weather_code ?? 0),
        temperatureC: Math.round(current.temperature_2m ?? 15),
        windSpeedKmh: Math.round(current.wind_speed_10m ?? 0),
        windDirection: current.wind_direction_10m ?? 0,
        humidity: Math.round(current.relative_humidity_2m ?? 50),
        cloudCover: (current.cloud_cover ?? 0) / 100,
        visibilityKm: current.visibility != null
          ? Math.round(current.visibility / 1000)
          : 10,
        isFetching: false,
        fetchedAt: Date.now(),
        stationName: `${lat.toFixed(1)}, ${lng.toFixed(1)}`,
      });
    } catch {
      // Silently fail — weather is a nice-to-have, not critical.
      set({ isFetching: false });
    }
  },

  setCondition: (condition) => set({ condition }),

  reset: () => set(createDefaultWeather()),
}));
