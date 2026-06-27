import { create } from 'zustand';

export type MusicGenre = 'classical' | 'jazz' | 'lofi' | 'ambient' | 'electronic' | 'cinematic';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  license: string;
  streamUrl: string;
}

type MusicStatus = 'idle' | 'loading' | 'ready' | 'error';

interface MusicStore {
  genre: MusicGenre | null;
  tracks: MusicTrack[];
  index: number;
  isPlaying: boolean;
  volume: number;
  status: MusicStatus;
  error: string | null;

  loadGenre: (genre: MusicGenre) => Promise<void>;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
}

export const useMusicStore = create<MusicStore>((set, get) => ({
  genre: null,
  tracks: [],
  index: 0,
  isPlaying: false,
  volume: 0.35, // quiet default — focus background, not foreground
  status: 'idle',
  error: null,

  loadGenre: async (genre) => {
    // Toggling the active genre off stops playback.
    if (get().genre === genre && get().status === 'ready') {
      set({ isPlaying: !get().isPlaying });
      return;
    }
    set({ status: 'loading', error: null, genre });
    try {
      const res = await fetch(`/.netlify/functions/music-list?genre=${genre}`);
      if (!res.ok) throw new Error(`music-list ${res.status}`);
      const data = await res.json();
      const tracks: MusicTrack[] = data?.tracks ?? [];
      if (tracks.length === 0) {
        set({ status: 'error', error: 'No tracks found', tracks: [], isPlaying: false });
        return;
      }
      set({ tracks, index: 0, status: 'ready', isPlaying: true });
    } catch (e) {
      set({
        status: 'error',
        error: e instanceof Error ? e.message : 'Failed to load music',
        tracks: [],
        isPlaying: false,
      });
    }
  },

  play: () => { if (get().tracks.length > 0) set({ isPlaying: true }); },
  pause: () => set({ isPlaying: false }),
  toggle: () => { if (get().tracks.length > 0) set({ isPlaying: !get().isPlaying }); },

  next: () => {
    const { tracks, index } = get();
    if (tracks.length === 0) return;
    set({ index: (index + 1) % tracks.length, isPlaying: true });
  },

  prev: () => {
    const { tracks, index } = get();
    if (tracks.length === 0) return;
    set({ index: (index - 1 + tracks.length) % tracks.length, isPlaying: true });
  },

  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
}));
