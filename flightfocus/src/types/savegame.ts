import type { Place, TransportMode } from './place';

export interface VisitedPlace {
  id: string;
  place: Place;
  arrivedAt: number;          // timestamp (ms)
  departedFrom: string;       // id of where this leg started
  ambientMinutesDuring: number; // real minutes the sim ran on the leg that brought you here
  distanceKm: number;         // distance of the leg that brought you here
  crossedEquator?: boolean;   // the leg flipped hemispheres
  crossedDateline?: boolean;  // the leg crossed the international date line
  departedLocalHour?: number; // local hour (0-23) at the departure place when the leg began
  cruiseMinutes?: number;     // real minutes spent at CRUISE phase during the leg
  transportMode: TransportMode; // how you got here
}

export interface JournalEntry {
  id: string;
  fromPlace: Place;
  toPlace: Place;
  text: string;               // AI-generated (or template fallback) diary entry about time in `fromPlace`
  svgKey: string;             // lookup key into citySketchData (usually fromPlace.id)
  createdAt: number;
  ambientMinutesDuring: number;
  isGenerating?: boolean;     // true while the LLM call is in-flight
  isFallback?: boolean;       // true if generated from the local template (no API)
}

export interface SaveStats {
  totalLegs: number;
  totalFlights: number;
  totalDrives: number;
  totalSails: number;
  totalAmbientMinutes: number; // real wall-clock minutes the sim ran across all legs
  totalDistanceKm: number;
  longestLegKm: number;
  shortestLegKm: number;
  maxCruiseMinutesInLeg: number;
  miles: number; // reward points earned from travel + focus time
}

export interface SaveGame {
  id: string;
  name: string;
  createdAt: number;
  lastPlayedAt: number;
  originId: string;             // the very first place (for "Homecoming")
  currentPlace: Place;          // where you currently are (= last arrival)
  visitedPlaces: VisitedPlace[];
  journalEntries: JournalEntry[];
  unlockedAchievements: string[];
  achievementUnlockedAt: Record<string, number>;
  stats: SaveStats;
}

export function createEmptySaveStats(): SaveStats {
  return {
    totalLegs: 0,
    totalFlights: 0,
    totalDrives: 0,
    totalSails: 0,
    totalAmbientMinutes: 0,
    totalDistanceKm: 0,
    longestLegKm: 0,
    shortestLegKm: Infinity,
    maxCruiseMinutesInLeg: 0,
    miles: 0,
  };
}

// Award miles: 1 mile per km traveled + 2 miles per real focus minute.
export function calculateMilesEarned(distanceKm: number, ambientMinutes: number): number {
  return Math.round(distanceKm + ambientMinutes * 2);
}

// Backward compatibility aliases
export type VisitedAirport = VisitedPlace;
