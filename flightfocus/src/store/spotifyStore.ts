import { create } from 'zustand';
import {
  buildSpotifyAuthUrl,
  exchangeSpotifyCode,
  refreshSpotifyToken,
  getCurrentlyPlaying,
  isSpotifyConfigured,
  type SpotifyTokens,
  type SpotifyTrack,
} from '@/utils/spotify';

const STORAGE_KEY = 'spotify_tokens';

function loadTokens(): SpotifyTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveTokens(tokens: SpotifyTokens | null) {
  if (tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(STORAGE_KEY);
}

interface SpotifyStore {
  connected: boolean;
  track: SpotifyTrack | null;
  polling: boolean;
  error: string | null;

  connect: () => Promise<void>;
  disconnect: () => void;
  handleCallback: (code: string) => Promise<void>;
  pollPlayback: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useSpotifyStore = create<SpotifyStore>((set, get) => ({
  connected: !!loadTokens(),
  track: null,
  polling: false,
  error: null,

  connect: async () => {
    if (!isSpotifyConfigured()) {
      set({ error: 'Spotify client ID not configured' });
      return;
    }
    const url = await buildSpotifyAuthUrl();
    window.location.href = url;
  },

  disconnect: () => {
    saveTokens(null);
    set({ connected: false, track: null });
    get().stopPolling();
  },

  handleCallback: async (code: string) => {
    try {
      const tokens = await exchangeSpotifyCode(code);
      saveTokens(tokens);
      set({ connected: true, error: null });
      get().startPolling();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Spotify auth failed' });
    }
  },

  pollPlayback: async () => {
    const tokens = loadTokens();
    if (!tokens) {
      set({ connected: false });
      get().stopPolling();
      return;
    }

    // Refresh if token expires within 60s.
    let activeTokens = tokens;
    if (Date.now() > tokens.expires_at - 60000) {
      try {
        activeTokens = await refreshSpotifyToken(tokens.refresh_token);
        saveTokens(activeTokens);
      } catch {
        set({ error: 'Spotify session expired' });
        get().disconnect();
        return;
      }
    }

    try {
      const track = await getCurrentlyPlaying(activeTokens.access_token);
      set({ track, error: null });
    } catch (e) {
      if (e instanceof Error && e.message === 'token_expired') {
        try {
          activeTokens = await refreshSpotifyToken(activeTokens.refresh_token);
          saveTokens(activeTokens);
          const track = await getCurrentlyPlaying(activeTokens.access_token);
          set({ track, error: null });
        } catch {
          get().disconnect();
        }
      }
    }
  },

  startPolling: () => {
    if (pollInterval) return;
    set({ polling: true });
    void get().pollPlayback();
    pollInterval = setInterval(() => void get().pollPlayback(), 5000);
  },

  stopPolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    set({ polling: false });
  },
}));
