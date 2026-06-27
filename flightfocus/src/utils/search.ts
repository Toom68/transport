import type { Place, PlaceSearchResult, JourneyType } from '@/types/place';
import { places, getPlaceByIata } from '@/data/places';
import { airports } from '@/data/airports';
import type { Airport, AirportSearchResult } from '@/types/airport';

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (t === q) return 1.0;
  if (t.startsWith(q)) return 0.9;
  if (t.includes(q)) return 0.7;

  let score = 0;
  let qi = 0;
  let consecutive = 0;
  let lastMatchIndex = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1;
      if (lastMatchIndex === ti - 1) {
        consecutive++;
        score += consecutive * 0.5;
      } else {
        consecutive = 0;
      }
      lastMatchIndex = ti;
      qi++;
    }
  }

  if (qi < q.length) return 0;

  return (score / (t.length + q.length)) * 0.6;
}

export function searchPlaces(query: string, limit: number = 10, filterJourneyType?: JourneyType): PlaceSearchResult[] {
  if (!query || query.trim().length === 0) return [];

  const q = query.trim();
  const results: PlaceSearchResult[] = [];

  for (const place of places) {
    // Skip if filterJourneyType is set and place kind doesn't match
    if (filterJourneyType === 'fly' && place.kind !== 'airport') continue;
    if (filterJourneyType === 'sail' && place.kind !== 'port') continue;
    if (filterJourneyType === 'drive' && place.kind === 'port') continue; // can't drive to a port (usually)

    let bestScore = 0;
    let bestField: PlaceSearchResult['matchField'] = 'name';

    const fields: { value: string; field: PlaceSearchResult['matchField']; boost: number }[] = [
      { value: place.iata ?? '', field: 'iata', boost: 1.5 },
      { value: place.icao ?? '', field: 'icao', boost: 1.3 },
      { value: place.city, field: 'city', boost: 1.2 },
      { value: place.name, field: 'name', boost: 1.0 },
      { value: place.country, field: 'country', boost: 0.8 },
    ];

    for (const { value, field, boost } of fields) {
      if (!value) continue;
      const score = fuzzyScore(q, value) * boost;
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }

    if (bestScore > 0) {
      results.push({ place, score: bestScore, matchField: bestField });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// Backward-compatible wrapper
export function searchAirports(query: string, limit: number = 10): AirportSearchResult[] {
  if (!query || query.trim().length === 0) return [];

  const q = query.trim();
  const results: AirportSearchResult[] = [];

  for (const airport of airports) {
    let bestScore = 0;
    let bestField: AirportSearchResult['matchField'] = 'name';

    const fields: { value: string; field: AirportSearchResult['matchField']; boost: number }[] = [
      { value: airport.iata, field: 'iata', boost: 1.5 },
      { value: airport.icao, field: 'icao', boost: 1.3 },
      { value: airport.city, field: 'city', boost: 1.2 },
      { value: airport.name, field: 'name', boost: 1.0 },
      { value: airport.country, field: 'country', boost: 0.8 },
    ];

    for (const { value, field, boost } of fields) {
      const score = fuzzyScore(q, value) * boost;
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }

    if (bestScore > 0) {
      results.push({ airport, score: bestScore, matchField: bestField });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export function getAirportByIata(iata: string): Airport | undefined {
  return airports.find(a => a.iata === iata.toUpperCase());
}

export function getAirportByIcao(icao: string): Airport | undefined {
  return airports.find(a => a.icao === icao.toUpperCase());
}

export function getPlaceById(id: string): Place | undefined {
  return places.find(p => p.id === id);
}
