export type AudioChannelCategory = 'engine' | 'cabin' | 'environment' | 'weather';

export interface AudioChannel {
  id: string;
  name: string;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;
  category: AudioChannelCategory;
  hasLfo?: boolean;          // shows a "~" modulation badge in the UI
  phaseGated?: string;       // human label e.g. "boarding only" / "cruise+"
}

export interface FocusSession {
  id: string;
  startTime: number;
  endTime: number | null;
  duration: number;
  type: 'pomodoro' | 'custom' | 'free';
  isActive: boolean;
}

export interface TimerConfig {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

export type ViewMode = 'home' | 'grounded' | 'simulation' | 'fullscreen';

export type AudioPreset = 'auto' | 'focus' | 'night' | 'stormy' | 'takeoff' | 'silent';
