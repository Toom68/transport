import { create } from 'zustand';
import type { AudioChannel, AudioPreset } from '@/types/simulation';
import type { NoiseChannelOptions, SampleChannelOptions } from '@/utils/audio';

// Synthesized noise channels (constructed once on init).
export const CHANNEL_ENGINE_OPTIONS: Record<string, NoiseChannelOptions> = {
  wind: { type: 'pink', lowpass: 6000, highpass: 2000, pan: 0.2, lfoRate: 0.12, lfoDepth: 0.06 },
  cabin: { type: 'pink', lowpass: 1200, pan: 0, reverb: true },
  hvac: { type: 'white', lowpass: 3000, pan: 0.1, lfoRate: 0.05, lfoDepth: 0.05 },
  // Turbulence now carries a sub-bass rumble layer (~70 Hz) for deeper, lower-freq motion.
  turbulence: {
    type: 'brown',
    lowpass: 150,
    pan: 0,
    lfoRate: 0.5,
    lfoDepth: 0.25,
    layers: [{ type: 'brown', lowpass: 70, gain: 0.85 }],
  },
  pressure: { type: 'pink', lowpass: 700, highpass: 200, pan: 0 },
};

// Looping sample-backed channels (real recordings). Fall back to noise if a file fails to load.
export const SAMPLE_LOOP_OPTIONS: Record<string, SampleChannelOptions> = {
  engine: { url: '/audio/engine.mp3', lowpass: 16000, pan: -0.15 },
  boarding: { url: '/audio/boarding.mp3', pan: -0.05 },
  rain: { url: '/audio/rain.mp3', pan: 0 },
};

// Synthesized fallbacks used only if the matching sample file can't be loaded.
export const SAMPLE_FALLBACK_NOISE: Record<string, NoiseChannelOptions> = {
  engine: { type: 'brown', lowpass: 200, highpass: 40, pan: -0.15, lfoRate: 0.08, lfoDepth: 0.08 },
  boarding: { type: 'pink', lowpass: 2000, pan: -0.05 },
  rain: {
    type: 'pink',
    lowpass: 9000,
    highpass: 2500,
    pan: 0,
    layers: [{ type: 'pink', lowpass: 500, gain: 0.6 }],
  },
};

// One-shot sample files (played on phase transitions / scheduled events).
export const ONE_SHOT_SAMPLES = {
  chime: '/audio/chime.mp3',
  takeoff: '/audio/takeoff.mp3',
  landing: '/audio/landing.mp3',
  thunder: '/audio/thunder.mp3',
} as const;

const defaultChannels: AudioChannel[] = [
  { id: 'engine', name: 'Engine', volume: 0.6, isMuted: false, isPlaying: true, category: 'engine', hasLfo: true },
  { id: 'wind', name: 'Slipstream', volume: 0.3, isMuted: true, isPlaying: false, category: 'engine', hasLfo: true, phaseGated: 'cruise+' },
  { id: 'cabin', name: 'Cabin Ambience', volume: 0.3, isMuted: false, isPlaying: true, category: 'cabin' },
  { id: 'hvac', name: 'Air Conditioning', volume: 0.4, isMuted: false, isPlaying: true, category: 'cabin', hasLfo: true },
  { id: 'boarding', name: 'Boarding Ambience', volume: 0.3, isMuted: false, isPlaying: true, category: 'cabin', phaseGated: 'boarding' },
  { id: 'rain', name: 'Rain', volume: 0, isMuted: true, isPlaying: false, category: 'weather' },
  { id: 'thunder', name: 'Distant Thunder', volume: 0, isMuted: true, isPlaying: false, category: 'weather', phaseGated: 'with rain' },
  { id: 'turbulence', name: 'Turbulence', volume: 0, isMuted: true, isPlaying: false, category: 'environment', hasLfo: true },
  { id: 'pressure', name: 'Cabin Pressure', volume: 0, isMuted: true, isPlaying: false, category: 'environment', phaseGated: 'climb/descent' },
];

export interface PresetConfig {
  label: string;
  icon: string; // lucide icon name
  // channel id -> {volume, muted}. Channels omitted are silenced.
  channels: Record<string, { volume: number; muted: boolean }>;
}

export const AUDIO_PRESETS: Record<Exclude<AudioPreset, 'auto'>, PresetConfig> = {
  focus: {
    label: 'Focus',
    icon: 'Headphones',
    channels: {
      engine: { volume: 0.4, muted: false },
      hvac: { volume: 0.5, muted: false },
      cabin: { volume: 0.2, muted: false },
    },
  },
  night: {
    label: 'Night Flight',
    icon: 'Moon',
    channels: {
      engine: { volume: 0.18, muted: false },
      cabin: { volume: 0.28, muted: false },
      hvac: { volume: 0.3, muted: false },
    },
  },
  stormy: {
    label: 'Stormy',
    icon: 'CloudRain',
    channels: {
      engine: { volume: 0.3, muted: false },
      cabin: { volume: 0.15, muted: false },
      rain: { volume: 0.7, muted: false },
      thunder: { volume: 0.5, muted: false },
      turbulence: { volume: 0.5, muted: false },
    },
  },
  takeoff: {
    label: 'Takeoff',
    icon: 'PlaneTakeoff',
    channels: {
      engine: { volume: 0.8, muted: false },
      cabin: { volume: 0.12, muted: false },
      wind: { volume: 0.4, muted: false },
    },
  },
  silent: {
    label: 'Silent',
    icon: 'VolumeX',
    channels: {},
  },
};

interface AudioStore {
  channels: AudioChannel[];
  masterVolume: number;
  isInitialized: boolean;
  activePreset: AudioPreset;

  setMasterVolume: (volume: number) => void;
  setChannelVolume: (id: string, volume: number) => void;
  toggleChannelMute: (id: string) => void;
  setInitialized: (value: boolean) => void;
  setPreset: (preset: AudioPreset) => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  channels: defaultChannels,
  masterVolume: 0.7,
  isInitialized: false,
  activePreset: 'auto',

  setMasterVolume: (volume) => set({ masterVolume: volume }),

  // Manual edits switch out of any active preset's auto-management but keep
  // automation off (we move to 'silent'-style manual control by tagging the
  // preset as the current one; auto only re-enables when the user picks Auto).
  setChannelVolume: (id, volume) =>
    set((state) => ({
      channels: state.channels.map((ch) =>
        ch.id === id ? { ...ch, volume, isMuted: volume === 0 ? ch.isMuted : false } : ch
      ),
    })),

  toggleChannelMute: (id) =>
    set((state) => ({
      channels: state.channels.map((ch) =>
        ch.id === id ? { ...ch, isMuted: !ch.isMuted } : ch
      ),
    })),

  setInitialized: (value) => set({ isInitialized: value }),

  setPreset: (preset) =>
    set((state) => {
      if (preset === 'auto') {
        return { activePreset: 'auto' };
      }
      const cfg = AUDIO_PRESETS[preset];
      const channels = state.channels.map((ch) => {
        const target = cfg.channels[ch.id];
        if (target) {
          return { ...ch, volume: target.volume, isMuted: target.muted, isPlaying: !target.muted };
        }
        return { ...ch, volume: 0, isMuted: true, isPlaying: false };
      });
      return { activePreset: preset, channels };
    }),
}));
