import type { Place } from './place';
import type { TransportMode } from './place';

export interface RoutePoint {
  lat: number;
  lng: number;
  distanceFromStart: number;
  bearing: number;
  progress: number;
}

export interface JourneyRoute {
  mode: TransportMode;
  departure: Place;
  arrival: Place;
  distance: number;
  duration: number;
  bearing: number;
  points: RoutePoint[];
}

export interface JourneyPosition {
  lat: number;
  lng: number;
  altitude: number;
  speed: number;
  heading: number;
  progress: number;
  distanceRemaining: number;
  timeRemaining: number;
}

// All phases across all transport modes
export type JourneyPhase =
  // Flight phases
  | 'BOARDING'
  | 'TAXI'
  | 'TAKEOFF'
  | 'CLIMB'
  | 'CRUISE'
  | 'DESCENT'
  | 'APPROACH'
  | 'LANDING'
  // Drive phases
  | 'DEPARTING'
  | 'DRIVING'
  | 'ARRIVING'
  // Sail phases
  | 'SAILING'
  | 'DOCKING'
  // Common
  | 'ARRIVED';

export interface PhaseConfig {
  phase: JourneyPhase;
  durationFraction: number;
  altitudeStart: number;
  altitudeEnd: number;
  speedKnots: number;
  progressStart: number;
  progressEnd: number;
}

export interface JourneyState {
  mode: TransportMode;
  phase: JourneyPhase;
  position: JourneyPosition;
  elapsedTime: number;
  totalDuration: number;
  route: JourneyRoute | null;
  isActive: boolean;
  isPaused: boolean;
  timeScale: number;
}

// Backward compatibility aliases
export type FlightRoute = JourneyRoute;
export type FlightPosition = JourneyPosition;
export type FlightPhase = JourneyPhase;
export type FlightState = JourneyState;
