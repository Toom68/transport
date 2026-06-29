import { create } from 'zustand';
import type { Airport } from '@/types/airport';
import type { Place, JourneyType } from '@/types/place';
import type { JourneyPhase, JourneyRoute, JourneyPosition } from '@/types/journey';
import type { FlightPhase, FlightRoute, FlightPosition } from '@/types/flight';
import type { ViewMode } from '@/types/simulation';
import { generateRoute, generateRouteAsync, generateFlightRoute, getPositionAtProgress } from '@/engine/route';
import {
  getPhaseForProgress,
  getPhaseForProgressAndMode,
  getGroundPhase,
  getGroundPhaseForMode,
  getGroundSpeed,
  getGroundSpeedForMode,
  getGroundTotalSeconds,
  getGroundWorldSeconds,
  GROUND_TOTAL_SECONDS,
  GROUND_WORLD_SECONDS,
} from '@/engine/simulation';
import { getAltitudeForProgress, getSpeedForProgress, getAltitudeForMode, getSpeedForMode } from '@/engine/navigation';
import { getTimezoneOffsetMs, getLocalHourInTimezone } from '@/utils/time';
import { useMultiplayerStore } from '@/store/multiplayerStore';
import type { SimSyncState, MultiplayerMode } from '@/types/multiplayer';

type TimeMode = 'realtime' | 'custom';

const PERSIST_KEY = 'transportfocus-inflight';
const PERSIST_INTERVAL_MS = 2000;

interface PersistedFlight {
  departure: Place;
  arrival: Place;
  route: JourneyRoute;
  phase: JourneyPhase;
  position: JourneyPosition;
  journeyType: JourneyType;
  progress: number;
  elapsedTime: number;
  isActive: boolean;
  isPaused: boolean;
  timeScale: number;
  viewMode: ViewMode;
  groundElapsed: number;
  timeMode: TimeMode;
  departureTimeUTC: number;
  customHour: number;
  simulationDateMs: number;
  sessionRealSeconds: number;
  cruiseRealSeconds: number;
  departedLocalHour: number | null;
  arrivalProcessed: boolean;
  savedAt: number;
}

function savePersistedFlight(data: PersistedFlight) {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

function loadPersistedFlight(): PersistedFlight | null {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedFlight;
  } catch {
    return null;
  }
}

function clearPersistedFlight() {
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // ignore
  }
}

export function hasPersistedFlight(): boolean {
  return loadPersistedFlight() !== null;
}

function broadcastState(s: FlightStore) {
  if (!s.departure || !s.arrival || !s.route) return;
  const syncState: SimSyncState = {
    departure: s.departure,
    arrival: s.arrival,
    route: s.route,
    journeyType: s.journeyType,
    phase: s.phase,
    progress: s.progress,
    groundElapsed: s.groundElapsed,
    elapsedTime: s.elapsedTime,
    timeScale: s.timeScale,
    isPaused: s.isPaused,
    departureTimeUTC: s.departureTimeUTC,
    sessionRealSeconds: s.sessionRealSeconds,
    cruiseRealSeconds: s.cruiseRealSeconds,
    departedLocalHour: s.departedLocalHour,
    timestamp: Date.now(),
  };
  useMultiplayerStore.getState().broadcastSimState(syncState);
}

export function getPersistedFlightInfo(): { fromCity: string; toCity: string; phase: string; savedAt: number } | null {
  const p = loadPersistedFlight();
  if (!p) return null;
  return {
    fromCity: p.departure.city,
    toCity: p.arrival.city,
    phase: p.phase,
    savedAt: p.savedAt,
  };
}

interface FlightStore {
  departure: Place | null;
  arrival: Place | null;
  route: JourneyRoute | null;
  phase: JourneyPhase;
  position: JourneyPosition;
  journeyType: JourneyType;
  progress: number;
  elapsedTime: number;
  isActive: boolean;
  isPaused: boolean;
  timeScale: number;
  viewMode: ViewMode;
  groundElapsed: number;        // real (unscaled) seconds elapsed in the ground sequence
  timeMode: TimeMode;
  departureTimeUTC: number;
  customHour: number;
  simulationDate: Date;
  sessionRealSeconds: number;   // real wall-clock seconds the sim has run this leg (unscaled)
  cruiseRealSeconds: number;    // real wall-clock seconds spent at CRUISE this leg
  departedLocalHour: number | null; // local hour at departure airport when the leg began
  arrivalProcessed: boolean;    // guards once-only arrival recording (StrictMode-safe)
  isRouteLoading: boolean;      // true while fetching drive route from API
  multiplayerMode: MultiplayerMode;

  setMultiplayerMode: (mode: MultiplayerMode) => void;
  applyRemoteState: (state: SimSyncState) => void;
  setDeparture: (place: Place | null) => void;
  setArrival: (place: Place | null) => void;
  setJourneyType: (journeyType: JourneyType) => void;
  startFlight: () => Promise<void>;
  pauseFlight: () => void;
  resumeFlight: () => void;
  stopFlight: () => void;
  returnToGrounded: () => void;
  markArrivalProcessed: () => void;
  setTimeScale: (scale: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setTimeMode: (mode: TimeMode) => void;
  setCustomHour: (hour: number) => void;
  tick: (deltaSeconds: number) => void;
  restorePersistedFlight: () => boolean;
  discardPersistedFlight: () => void;
}

export const useFlightStore = create<FlightStore>((set, get) => ({
  departure: null,
  arrival: null,
  route: null,
  phase: 'BOARDING',
  position: { lat: 0, lng: 0, altitude: 0, speed: 0, heading: 0, progress: 0, distanceRemaining: 0, timeRemaining: 0 },
  journeyType: 'fly',
  progress: 0,
  elapsedTime: 0,
  isActive: false,
  isPaused: false,
  timeScale: 1,
  viewMode: 'home',
  groundElapsed: 0,
  timeMode: 'realtime',
  departureTimeUTC: Date.now(),
  customHour: 10,
  simulationDate: new Date(),
  sessionRealSeconds: 0,
  cruiseRealSeconds: 0,
  departedLocalHour: null,
  arrivalProcessed: false,
  isRouteLoading: false,
  multiplayerMode: 'off',
  _lastPersistMs: 0,
  _lastBroadcastMs: 0,

  setMultiplayerMode: (mode) => set({ multiplayerMode: mode }),

  setDeparture: (place) => set({ departure: place }),
  setArrival: (place) => set({ arrival: place }),
  setJourneyType: (journeyType) => set({ journeyType }),

  startFlight: async () => {
    const { departure, arrival, timeMode, customHour, journeyType } = get();
    if (!departure || !arrival) return;

    // For drive mode, fetch real road route from Mapbox Directions API
    let route: JourneyRoute;
    if (journeyType === 'drive') {
      set({ isRouteLoading: true });
      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN ?? '';
      try {
        route = await generateRouteAsync(departure, arrival, journeyType, mapboxToken);
      } catch {
        route = generateRoute(departure, arrival, journeyType);
      }
      set({ isRouteLoading: false });
    } else {
      route = generateRoute(departure, arrival, journeyType);
    }

    // Calculate departure time in UTC
    let departureUTC: number;
    if (timeMode === 'realtime') {
      departureUTC = Date.now();
    } else {
      // Custom time: interpret customHour as local time at departure airport
      // Use the departure timezone to convert to UTC
      const now = new Date();
      const depLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), customHour, 0, 0);
      // Get UTC offset for the departure timezone
      const depTzOffset = getTimezoneOffsetMs(departure.timezone, depLocal);
      departureUTC = depLocal.getTime() - depTzOffset;
    }

    set({
      route,
      phase: 'BOARDING',
      progress: 0,
      elapsedTime: 0,
      isActive: true,
      isPaused: false,
      viewMode: 'simulation',
      departureTimeUTC: departureUTC,
      simulationDate: new Date(departureUTC),
      groundElapsed: 0,
      sessionRealSeconds: 0,
      cruiseRealSeconds: 0,
      departedLocalHour: getLocalHourInTimezone(new Date(departureUTC), departure.timezone),
      arrivalProcessed: false,
      position: {
        lat: departure.lat,
        lng: departure.lng,
        altitude: 0,
        speed: 0,
        heading: route.bearing,
        progress: 0,
        distanceRemaining: route.distance,
        timeRemaining: route.duration,
      },
    });

    // Broadcast flight start to multiplayer guests
    if (get().multiplayerMode === 'host' && departure && arrival) {
      const syncState: SimSyncState = {
        departure, arrival, route, journeyType,
        phase: 'BOARDING', progress: 0, groundElapsed: 0, elapsedTime: 0,
        timeScale: get().timeScale, isPaused: false,
        departureTimeUTC: departureUTC,
        sessionRealSeconds: 0, cruiseRealSeconds: 0,
        departedLocalHour: getLocalHourInTimezone(new Date(departureUTC), departure.timezone),
        timestamp: Date.now(),
      };
      useMultiplayerStore.getState().broadcastFlightStarted(syncState);
    }
  },

  pauseFlight: () => {
    // Guests can't pause
    if (get().multiplayerMode === 'guest') return;
    set({ isPaused: true });
    // Broadcast to multiplayer guests
    if (get().multiplayerMode === 'host') broadcastState(get());
    // Persist immediately on pause so closing the tab preserves state
    const s = get();
    if (s.isActive && s.route && s.departure && s.arrival) {
      savePersistedFlight({
        departure: s.departure,
        arrival: s.arrival,
        route: s.route,
        phase: s.phase,
        position: s.position,
        journeyType: s.journeyType,
        progress: s.progress,
        elapsedTime: s.elapsedTime,
        isActive: true,
        isPaused: true,
        timeScale: s.timeScale,
        viewMode: s.viewMode,
        groundElapsed: s.groundElapsed,
        timeMode: s.timeMode,
        departureTimeUTC: s.departureTimeUTC,
        customHour: s.customHour,
        simulationDateMs: s.simulationDate.getTime(),
        sessionRealSeconds: s.sessionRealSeconds,
        cruiseRealSeconds: s.cruiseRealSeconds,
        departedLocalHour: s.departedLocalHour,
        arrivalProcessed: s.arrivalProcessed,
        savedAt: Date.now(),
      });
    }
  },
  resumeFlight: () => {
    if (get().multiplayerMode === 'guest') return;
    set({ isPaused: false });
    if (get().multiplayerMode === 'host') broadcastState(get());
  },
  markArrivalProcessed: () => set({ arrivalProcessed: true }),

  stopFlight: () => {
    // Broadcast flight ended before clearing
    if (get().multiplayerMode === 'host') {
      useMultiplayerStore.getState().broadcastFlightEnded();
    }
    clearPersistedFlight();
    set({
      route: null,
      arrival: null,
      phase: 'BOARDING',
      progress: 0,
      elapsedTime: 0,
      isActive: false,
      isPaused: false,
      viewMode: 'grounded',
      simulationDate: new Date(),
      groundElapsed: 0,
      sessionRealSeconds: 0,
      cruiseRealSeconds: 0,
      departedLocalHour: null,
      position: { lat: 0, lng: 0, altitude: 0, speed: 0, heading: 0, progress: 0, distanceRemaining: 0, timeRemaining: 0 },
    });
  },

  returnToGrounded: () => {
    clearPersistedFlight();
    set({
      route: null,
      arrival: null,
      phase: 'BOARDING',
      progress: 0,
      elapsedTime: 0,
      isActive: false,
      isPaused: false,
      viewMode: 'grounded',
      groundElapsed: 0,
      sessionRealSeconds: 0,
      cruiseRealSeconds: 0,
      departedLocalHour: null,
      position: { lat: 0, lng: 0, altitude: 0, speed: 0, heading: 0, progress: 0, distanceRemaining: 0, timeRemaining: 0 },
    });
  },

  setTimeScale: (scale) => {
    if (get().multiplayerMode === 'guest') return;
    set({ timeScale: scale });
    if (get().multiplayerMode === 'host') broadcastState(get());
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setTimeMode: (mode) => set({ timeMode: mode }),
  setCustomHour: (hour) => set({ customHour: hour }),

  tick: (deltaSeconds) => {
    // Guests don't tick — sim state comes from host via realtime
    if (get().multiplayerMode === 'guest') return;

    const {
      isActive, isPaused, timeScale, elapsedTime, route,
      groundElapsed, sessionRealSeconds, cruiseRealSeconds, departureTimeUTC,
      journeyType,
    } = get();
    if (!isActive || isPaused || !route) return;

    // Real (unscaled) wall-clock time the sim has been running this leg.
    const newSessionReal = sessionRealSeconds + deltaSeconds;

    const modeGroundTotal = getGroundTotalSeconds(journeyType);
    const modeGroundWorld = getGroundWorldSeconds(journeyType);

    // --- Ground sequence (boarding -> taxi -> takeoff / departing) -------
    // Runs in REAL time, unaffected by timeScale. The vehicle stays parked at
    // the departure point: progress stays 0, so no great-circle movement.
    if (groundElapsed < modeGroundTotal) {
      const newGround = Math.min(modeGroundTotal, groundElapsed + deltaSeconds);
      const phase = getGroundPhaseForMode(newGround, journeyType) ?? 'TAKEOFF';
      const speed = getGroundSpeedForMode(newGround, journeyType);
      // Day/night clock advances through the notional ground-world duration.
      const simDate = new Date(
        departureTimeUTC + (newGround / modeGroundTotal) * modeGroundWorld * 1000
      );

      set({
        groundElapsed: newGround,
        phase,
        progress: 0,
        elapsedTime: 0,
        simulationDate: simDate,
        sessionRealSeconds: newSessionReal,
        position: {
          lat: route.departure.lat,
          lng: route.departure.lng,
          altitude: 0,
          speed,
          heading: route.bearing,
          progress: 0,
          distanceRemaining: route.distance,
          timeRemaining: route.duration,
        },
      });
      return;
    }

    // --- Enroute (journey clock starts here, scaled by timeScale) --------
    const scaledDelta = deltaSeconds * timeScale;
    const newElapsed = elapsedTime + scaledDelta;
    const progress = Math.min(1, newElapsed / route.duration);
    const phase = getPhaseForProgressAndMode(progress, journeyType);

    const newCruiseReal = (phase === 'CRUISE' || phase === 'DRIVING' || phase === 'SAILING')
      ? cruiseRealSeconds + deltaSeconds : cruiseRealSeconds;

    const routePoint = getPositionAtProgress(route, progress);
    const altitude = getAltitudeForMode(progress, journeyType);
    const speed = getSpeedForMode(progress, journeyType);

    const distanceRemaining = route.distance * (1 - progress);
    const timeRemaining = Math.max(0, route.duration - newElapsed);

    // Real-world time at the vehicle position: notional ground time + enroute time.
    const simDate = new Date(
      departureTimeUTC + (modeGroundWorld + progress * route.duration) * 1000
    );

    set({
      elapsedTime: newElapsed,
      progress,
      phase,
      simulationDate: simDate,
      sessionRealSeconds: newSessionReal,
      cruiseRealSeconds: newCruiseReal,
      position: {
        lat: routePoint.lat,
        lng: routePoint.lng,
        altitude,
        speed,
        heading: routePoint.bearing,
        progress,
        distanceRemaining,
        timeRemaining,
      },
    });

    if (progress >= 1) {
      clearPersistedFlight();
      set({ phase: 'ARRIVED', isPaused: true });
    }

    // Throttled multiplayer broadcast — every ~1s
    const broadcastNow = Date.now();
    const bState = get();
    if (bState.multiplayerMode === 'host' && broadcastNow - (bState as any)._lastBroadcastMs > 1000) {
      (bState as any)._lastBroadcastMs = broadcastNow;
      broadcastState(bState);
    }

    // Throttled persistence — save every ~2s so tab close preserves state
    const now = Date.now();
    const state = get();
    if (now - (state as any)._lastPersistMs > PERSIST_INTERVAL_MS) {
      (state as any)._lastPersistMs = now;
      if (state.isActive && state.route && state.departure && state.arrival) {
        savePersistedFlight({
          departure: state.departure,
          arrival: state.arrival,
          route: state.route,
          phase,
          position: state.position,
          journeyType: state.journeyType,
          progress,
          elapsedTime: newElapsed,
          isActive: true,
          isPaused: false,
          timeScale: state.timeScale,
          viewMode: state.viewMode,
          groundElapsed: state.groundElapsed,
          timeMode: state.timeMode,
          departureTimeUTC: state.departureTimeUTC,
          customHour: state.customHour,
          simulationDateMs: simDate.getTime(),
          sessionRealSeconds: newSessionReal,
          cruiseRealSeconds: newCruiseReal,
          departedLocalHour: state.departedLocalHour,
          arrivalProcessed: state.arrivalProcessed,
          savedAt: now,
        });
      }
    }
  },

  restorePersistedFlight: () => {
    const p = loadPersistedFlight();
    if (!p) return false;
    set({
      departure: p.departure,
      arrival: p.arrival,
      route: p.route,
      phase: p.phase,
      position: p.position,
      journeyType: p.journeyType ?? 'fly',
      progress: p.progress,
      elapsedTime: p.elapsedTime,
      isActive: p.isActive,
      isPaused: true, // always resume paused so user can unpause
      timeScale: p.timeScale,
      viewMode: 'simulation',
      groundElapsed: p.groundElapsed,
      timeMode: p.timeMode,
      departureTimeUTC: p.departureTimeUTC,
      customHour: p.customHour,
      simulationDate: new Date(p.simulationDateMs),
      sessionRealSeconds: p.sessionRealSeconds,
      cruiseRealSeconds: p.cruiseRealSeconds,
      departedLocalHour: p.departedLocalHour,
      arrivalProcessed: p.arrivalProcessed,
    });
    return true;
  },

  discardPersistedFlight: () => {
    clearPersistedFlight();
  },

  applyRemoteState: (state) => {
    // Only guests apply remote state
    if (get().multiplayerMode !== 'guest') return;

    const { route } = get();
    const hasRoute = !!route && route.departure.id === state.departure.id;

    if (!hasRoute) {
      // First update or new route from host — set everything
      const routePoint = getPositionAtProgress(state.route, state.progress);
      const altitude = getAltitudeForMode(state.progress, state.journeyType);
      const speed = getSpeedForMode(state.progress, state.journeyType);
      set({
        departure: state.departure,
        arrival: state.arrival,
        route: state.route,
        journeyType: state.journeyType,
        phase: state.phase,
        progress: state.progress,
        elapsedTime: state.elapsedTime,
        groundElapsed: state.groundElapsed,
        timeScale: state.timeScale,
        isPaused: state.isPaused,
        isActive: true,
        viewMode: 'simulation',
        departureTimeUTC: state.departureTimeUTC,
        simulationDate: new Date(state.departureTimeUTC + (state.groundElapsed + state.elapsedTime) * 1000),
        sessionRealSeconds: state.sessionRealSeconds,
        cruiseRealSeconds: state.cruiseRealSeconds,
        departedLocalHour: state.departedLocalHour,
        arrivalProcessed: state.phase === 'ARRIVED',
        position: {
          lat: routePoint.lat,
          lng: routePoint.lng,
          altitude,
          speed,
          heading: routePoint.bearing,
          progress: state.progress,
          distanceRemaining: state.route.distance * (1 - state.progress),
          timeRemaining: Math.max(0, state.route.duration - state.elapsedTime),
        },
      });
    } else {
      // Subsequent updates — just advance progress/phase
      const routePoint = getPositionAtProgress(state.route, state.progress);
      const altitude = getAltitudeForMode(state.progress, state.journeyType);
      const speed = getSpeedForMode(state.progress, state.journeyType);
      set({
        phase: state.phase,
        progress: state.progress,
        elapsedTime: state.elapsedTime,
        groundElapsed: state.groundElapsed,
        timeScale: state.timeScale,
        isPaused: state.isPaused,
        simulationDate: new Date(state.departureTimeUTC + (state.groundElapsed + state.elapsedTime) * 1000),
        position: {
          lat: routePoint.lat,
          lng: routePoint.lng,
          altitude,
          speed,
          heading: routePoint.bearing,
          progress: state.progress,
          distanceRemaining: state.route.distance * (1 - state.progress),
          timeRemaining: Math.max(0, state.route.duration - state.elapsedTime),
        },
      });
    }
  },
}));
