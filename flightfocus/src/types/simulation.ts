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
  journeyType?: 'fly' | 'drive' | 'sail';  // restricts channel to a specific journey type
}

export type FocusMode = 'pomodoro' | 'custom' | 'free';

export type FocusGoalType = 'task' | 'subject' | 'chapter' | 'assignment' | 'custom';

export interface FocusGoal {
  type: FocusGoalType;
  subject: string;
  detail: string;
}

export type InterruptReason = 'resumed' | 'shortened' | 'interrupted' | 'rescheduled';

export interface FocusSession {
  id: string;
  startTime: number;
  endTime: number | null;
  duration: number;
  type: FocusMode;
  isActive: boolean;
  goal?: FocusGoal;
  completedTasks: string[];
  interrupted?: boolean;
  interruptReason?: InterruptReason;
}

export interface FocusTask {
  id: string;
  text: string;
  done: boolean;
}

export interface TimerConfig {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

export interface FocusAlertConfig {
  soundEnabled: boolean;
  visualEnabled: boolean;
  chimeType: 'bell' | 'chime' | 'soft';
}

export interface ScheduledSession {
  id: string;
  goal: FocusGoal;
  duration: number;
  scheduledFor: number;
  reminderShown: boolean;
}

export const PREDEFINED_SUBJECTS = [
  'Biology', 'Math', 'English', 'History', 'Chemistry',
  'Physics', 'Computer Science', 'Economics', 'Psychology', 'Other',
] as const;

export interface SubjectBreakdownEntry {
  subject: string;
  minutes: number;
  sessionCount: number;
  color: string;
}

export interface BreakRecommendation {
  minutes: number;
  reason: string;
}

export type ViewMode = 'home' | 'grounded' | 'simulation' | 'fullscreen';

export type AudioPreset = 'auto' | 'focus' | 'night' | 'stormy' | 'takeoff' | 'silent' | 'roadTrip' | 'nightDrive' | 'cityTraffic';
