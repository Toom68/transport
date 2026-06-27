import type { Airport } from './airport';

export interface RoutePoint {
  lat: number;
  lng: number;
  distanceFromStart: number;
  bearing: number;
  progress: number;
}

export interface FlightRoute {
  departure: Airport;
  arrival: Airport;
  distance: number;
  duration: number;
  bearing: number;
  points: RoutePoint[];
}

export interface FlightPosition {
  lat: number;
  lng: number;
  altitude: number;
  speed: number;
  heading: number;
  progress: number;
  distanceRemaining: number;
  timeRemaining: number;
}

export type FlightPhase =
  | 'BOARDING'
  | 'TAXI'
  | 'TAKEOFF'
  | 'CLIMB'
  | 'CRUISE'
  | 'DESCENT'
  | 'APPROACH'
  | 'LANDING'
  | 'ARRIVED';

export interface PhaseConfig {
  phase: FlightPhase;
  durationFraction: number;
  altitudeStart: number;
  altitudeEnd: number;
  speedKnots: number;
  progressStart: number;
  progressEnd: number;
}

export interface FlightState {
  phase: FlightPhase;
  position: FlightPosition;
  elapsedTime: number;
  totalDuration: number;
  route: FlightRoute | null;
  isActive: boolean;
  isPaused: boolean;
  timeScale: number;
}
