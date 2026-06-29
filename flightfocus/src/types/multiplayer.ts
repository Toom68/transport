import type { Place, JourneyType } from './place';
import type { JourneyRoute, JourneyPhase } from './journey';

export interface SimSyncState {
  departure: Place;
  arrival: Place;
  route: JourneyRoute;
  journeyType: JourneyType;
  phase: JourneyPhase;
  progress: number;
  groundElapsed: number;
  elapsedTime: number;
  timeScale: number;
  isPaused: boolean;
  departureTimeUTC: number;
  sessionRealSeconds: number;
  cruiseRealSeconds: number;
  departedLocalHour: number | null;
  timestamp: number;
}

export interface MultiplayerPlayer {
  id: string;
  name: string;
  isHost: boolean;
}

export interface MultiplayerRoom {
  code: string;
  hostSessionId: string;
  departure: Place | null;
  arrival: Place | null;
  route: JourneyRoute | null;
  journeyType: JourneyType;
  isActive: boolean;
  isPaused: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MultiplayerMode = 'off' | 'host' | 'guest';

export type RealtimeEvent =
  | { type: 'sim_state'; state: SimSyncState }
  | { type: 'flight_started'; state: SimSyncState }
  | { type: 'flight_ended' }
  | { type: 'room_closed' }
  | { type: 'player_kicked'; playerId: string }
  | { type: 'player_banned'; playerId: string };
