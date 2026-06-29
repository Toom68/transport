import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { SimSyncState, MultiplayerPlayer, RealtimeEvent } from '@/types/multiplayer';

const SESSION_KEY = 'transportfocus-session-id';
const NAME_KEY = 'transportfocus-player-name';

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getStoredName(): string {
  return localStorage.getItem(NAME_KEY) ?? '';
}

function setStoredName(name: string) {
  localStorage.setItem(NAME_KEY, name);
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'host_disconnected';

interface MultiplayerStore {
  role: 'host' | 'guest' | null;
  roomCode: string | null;
  hostSessionId: string | null;
  sessionId: string;
  playerName: string;
  isConnected: boolean;
  connectionState: ConnectionState;
  players: MultiplayerPlayer[];
  lastRemoteState: SimSyncState | null;
  kicked: boolean;
  banned: boolean;

  setPlayerName: (name: string) => void;
  createRoom: () => Promise<string>;
  joinRoom: (code: string) => Promise<boolean>;
  leaveRoom: () => void;
  endRoom: () => void;

  broadcastSimState: (state: SimSyncState) => void;
  broadcastFlightStarted: (state: SimSyncState) => void;
  broadcastFlightEnded: () => void;

  kickPlayer: (playerId: string) => void;
  banPlayer: (playerId: string) => void;

  _onRemoteState: (state: SimSyncState) => void;
  _onEvent: (event: RealtimeEvent) => void;
  _onPresenceSync: () => void;
  _setPlayers: (players: MultiplayerPlayer[]) => void;
}

function setupChannel(
  code: string,
  sessionId: string,
  name: string,
  isHost: boolean
) {
  const channel = supabase.channel(`room:${code}`, {
    config: { presence: { key: sessionId } },
  });

  // Cast to any to work around Supabase Realtime type limitations
  const ch = channel as any;

  ch.on('broadcast', { event: 'sim_state' }, (msg: any) => {
    useMultiplayerStore.getState()._onRemoteState(msg.payload as SimSyncState);
  });
  ch.on('broadcast', { event: 'flight_started' }, (msg: any) => {
    useMultiplayerStore.getState()._onEvent({ type: 'flight_started', state: msg.payload as SimSyncState });
  });
  ch.on('broadcast', { event: 'flight_ended' }, () => {
    useMultiplayerStore.getState()._onEvent({ type: 'flight_ended' });
  });
  ch.on('broadcast', { event: 'room_closed' }, () => {
    useMultiplayerStore.getState()._onEvent({ type: 'room_closed' });
  });
  ch.on('broadcast', { event: 'player_kicked' }, (msg: any) => {
    const { playerId } = msg.payload as { playerId: string };
    if (playerId === useMultiplayerStore.getState().sessionId) {
      useMultiplayerStore.setState({ kicked: true });
    }
    useMultiplayerStore.getState()._onEvent({ type: 'player_kicked', playerId });
  });
  ch.on('broadcast', { event: 'player_banned' }, (msg: any) => {
    const { playerId } = msg.payload as { playerId: string };
    if (playerId === useMultiplayerStore.getState().sessionId) {
      useMultiplayerStore.setState({ banned: true });
    }
    useMultiplayerStore.getState()._onEvent({ type: 'player_banned', playerId });
  });
  ch.on('broadcast', { event: 'state_request' }, async () => {
    // Only host responds — sends current sim state to the requesting guest
    const mpState = useMultiplayerStore.getState();
    if (mpState.role !== 'host') return;
    const { useFlightStore } = await import('@/store/flightStore');
    const fs = useFlightStore.getState();
    if (fs.departure && fs.arrival && fs.route) {
      const syncState: SimSyncState = {
        departure: fs.departure,
        arrival: fs.arrival,
        route: fs.route,
        journeyType: fs.journeyType,
        phase: fs.phase,
        progress: fs.progress,
        groundElapsed: fs.groundElapsed,
        elapsedTime: fs.elapsedTime,
        timeScale: fs.timeScale,
        isPaused: fs.isPaused,
        departureTimeUTC: fs.departureTimeUTC,
        sessionRealSeconds: fs.sessionRealSeconds,
        cruiseRealSeconds: fs.cruiseRealSeconds,
        departedLocalHour: fs.departedLocalHour,
        timestamp: Date.now(),
      };
      mpState.broadcastSimState(syncState);
    }
  });
  ch.on('presence', { event: 'sync' }, () => {
    useMultiplayerStore.getState()._onPresenceSync();
  });

  channel.subscribe();
  channel.track({ id: sessionId, name, isHost });

  return channel;
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  role: null,
  roomCode: null,
  hostSessionId: null,
  sessionId: getSessionId(),
  playerName: getStoredName(),
  isConnected: false,
  connectionState: 'disconnected',
  players: [],
  lastRemoteState: null,
  kicked: false,
  banned: false,

  setPlayerName: (name) => {
    setStoredName(name);
    set({ playerName: name });
    // Update presence if connected
    const { roomCode, sessionId, role } = get();
    if (roomCode && role) {
      const channel = supabase.channel(`room:${roomCode}`);
      channel.track({ id: sessionId, name, isHost: role === 'host' });
    }
  },

  createRoom: async () => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
    const { sessionId, playerName } = get();
    const name = playerName.trim() || 'Host';

    // Generate unique code
    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateRoomCode();
      const { data } = await supabase
        .from('multiplayer_rooms')
        .select('code')
        .eq('code', code)
        .maybeSingle();
      if (!data) break;
    }
    if (!code) throw new Error('Failed to generate unique room code');

    // Insert room row
    const { error } = await supabase
      .from('multiplayer_rooms')
      .insert({
        code,
        host_session_id: sessionId,
        host_name: name,
        is_active: true,
      });
    if (error) throw new Error(`Failed to create room: ${error.message}`);

    setupChannel(code, sessionId, name, true);

    set({
      role: 'host',
      roomCode: code,
      hostSessionId: sessionId,
      isConnected: true,
      connectionState: 'connected',
      players: [{ id: sessionId, name, isHost: true }],
    });

    return code;
  },

  joinRoom: async (code) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
    const upperCode = code.toUpperCase().trim();
    const { sessionId, playerName } = get();
    const name = playerName.trim() || 'Guest';

    // Look up room
    const { data, error } = await supabase
      .from('multiplayer_rooms')
      .select('*')
      .eq('code', upperCode)
      .maybeSingle();

    if (error || !data) return false;
    if (!data.is_active) return false;

    // Check ban list
    const bannedIds: string[] = data.banned_session_ids ?? [];
    if (bannedIds.includes(sessionId)) {
      set({ banned: true });
      return false;
    }

    setupChannel(upperCode, sessionId, name, false);

    // If room has a route already (mid-flight), request current state from host
    if (data.route && data.departure && data.arrival) {
      // Send state_request — host will respond with current sim state
      setTimeout(() => {
        const channel = supabase.channel(`room:${upperCode}`);
        channel.send({ type: 'broadcast', event: 'state_request', payload: {} });
      }, 500); // small delay to ensure subscription is ready
    }

    set({
      role: 'guest',
      roomCode: upperCode,
      hostSessionId: data.host_session_id,
      isConnected: true,
      connectionState: 'connected',
      players: [{ id: sessionId, name, isHost: false }],
    });

    return true;
  },

  leaveRoom: () => {
    const { roomCode, role } = get();
    if (roomCode) {
      const channel = supabase.channel(`room:${roomCode}`);
      channel.untrack();
      supabase.removeChannel(channel);
    }
    set({
      role: null,
      roomCode: null,
      hostSessionId: null,
      isConnected: false,
      connectionState: 'disconnected',
      players: [],
      lastRemoteState: null,
      kicked: false,
      banned: false,
    });
  },

  endRoom: async () => {
    const { roomCode } = get();
    if (!roomCode) return;

    // Broadcast room_closed to all guests
    const channel = supabase.channel(`room:${roomCode}`);
    await channel.send({ type: 'broadcast', event: 'room_closed', payload: {} });
    supabase.removeChannel(channel);

    // Mark room inactive in DB
    await supabase
      .from('multiplayer_rooms')
      .update({ is_active: false })
      .eq('code', roomCode);

    set({
      role: null,
      roomCode: null,
      hostSessionId: null,
      isConnected: false,
      connectionState: 'disconnected',
      players: [],
      lastRemoteState: null,
    });
  },

  broadcastSimState: (state) => {
    const { roomCode, role } = get();
    if (!roomCode || role !== 'host') return;
    const channel = supabase.channel(`room:${roomCode}`);
    channel.send({ type: 'broadcast', event: 'sim_state', payload: state });
  },

  broadcastFlightStarted: (state) => {
    const { roomCode, role } = get();
    if (!roomCode || role !== 'host') return;
    const channel = supabase.channel(`room:${roomCode}`);
    channel.send({ type: 'broadcast', event: 'flight_started', payload: state });

    // Also update the room row for late-joiners
    supabase
      .from('multiplayer_rooms')
      .update({
        departure: state.departure,
        arrival: state.arrival,
        route: state.route,
        journey_type: state.journeyType,
        is_paused: false,
        updated_at: new Date().toISOString(),
      })
      .eq('code', roomCode);
  },

  broadcastFlightEnded: () => {
    const { roomCode, role } = get();
    if (!roomCode || role !== 'host') return;
    const channel = supabase.channel(`room:${roomCode}`);
    channel.send({ type: 'broadcast', event: 'flight_ended', payload: {} });

    // Clear route from room row
    supabase
      .from('multiplayer_rooms')
      .update({
        departure: null,
        arrival: null,
        route: null,
        is_paused: false,
        updated_at: new Date().toISOString(),
      })
      .eq('code', roomCode);
  },

  kickPlayer: (playerId) => {
    const { roomCode, role } = get();
    if (!roomCode || role !== 'host') return;
    const channel = supabase.channel(`room:${roomCode}`);
    channel.send({ type: 'broadcast', event: 'player_kicked', payload: { playerId } });
  },

  banPlayer: async (playerId) => {
    const { roomCode, role } = get();
    if (!roomCode || role !== 'host') return;

    // Broadcast ban event
    const channel = supabase.channel(`room:${roomCode}`);
    channel.send({ type: 'broadcast', event: 'player_banned', payload: { playerId } });

    // Add to ban list in DB
    const { data } = await supabase
      .from('multiplayer_rooms')
      .select('banned_session_ids')
      .eq('code', roomCode)
      .maybeSingle();

    const banned: string[] = data?.banned_session_ids ?? [];
    if (!banned.includes(playerId)) {
      banned.push(playerId);
      await supabase
        .from('multiplayer_rooms')
        .update({ banned_session_ids: banned })
        .eq('code', roomCode);
    }
  },

  _onRemoteState: (state) => {
    set({ lastRemoteState: state });
  },

  _onEvent: (event) => {
    if (event.type === 'room_closed') {
      set({ connectionState: 'disconnected', role: null, roomCode: null, isConnected: false });
    } else if (event.type === 'flight_started') {
      set({ lastRemoteState: event.state });
    } else if (event.type === 'flight_ended') {
      set({ lastRemoteState: null });
    }
  },

  _onPresenceSync: () => {
    const { roomCode, role } = get();
    if (!roomCode) return;
    const channel = supabase.channel(`room:${roomCode}`);
    const presenceState = channel.presenceState<{ id: string; name: string; isHost: boolean }>();

    const players: MultiplayerPlayer[] = [];
    for (const [key, metas] of Object.entries(presenceState)) {
      if (metas.length === 0) continue;
      const meta = metas[metas.length - 1];
      players.push({
        id: meta.id ?? key,
        name: meta.name ?? 'Unknown',
        isHost: meta.isHost ?? false,
      });
    }

    // Check if host is still present
    const hostPresent = players.some((p) => p.isHost);
    if (role === 'guest' && !hostPresent) {
      set({ connectionState: 'host_disconnected' });
    } else if (role === 'guest' && hostPresent) {
      set({ connectionState: 'connected' });
    }

    set({ players });
  },

  _setPlayers: (players) => set({ players }),
}));
