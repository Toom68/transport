import { create } from 'zustand';
import type { FocusSession, TimerConfig } from '@/types/simulation';

interface FocusStore {
  isActive: boolean;
  currentSession: FocusSession | null;
  sessions: FocusSession[];
  timerConfig: TimerConfig;
  timeRemaining: number;
  isBreak: boolean;
  sessionCount: number;
  isFullscreen: boolean;
  isMinimalUI: boolean;

  startPomodoro: () => void;
  startCustomTimer: (durationMinutes: number) => void;
  stopTimer: () => void;
  tick: (deltaSeconds: number) => void;
  setTimerConfig: (config: Partial<TimerConfig>) => void;
  toggleFullscreen: () => void;
  toggleMinimalUI: () => void;
}

export const useFocusStore = create<FocusStore>((set, get) => ({
  isActive: false,
  currentSession: null,
  sessions: [],
  timerConfig: {
    workDuration: 25 * 60,
    breakDuration: 5 * 60,
    longBreakDuration: 15 * 60,
    sessionsBeforeLongBreak: 4,
  },
  timeRemaining: 25 * 60,
  isBreak: false,
  sessionCount: 0,
  isFullscreen: false,
  isMinimalUI: false,

  startPomodoro: () => {
    const { timerConfig } = get();
    const session: FocusSession = {
      id: Date.now().toString(),
      startTime: Date.now(),
      endTime: null,
      duration: timerConfig.workDuration,
      type: 'pomodoro',
      isActive: true,
    };
    set({
      isActive: true,
      currentSession: session,
      timeRemaining: timerConfig.workDuration,
      isBreak: false,
    });
  },

  startCustomTimer: (durationMinutes) => {
    const durationSeconds = durationMinutes * 60;
    const session: FocusSession = {
      id: Date.now().toString(),
      startTime: Date.now(),
      endTime: null,
      duration: durationSeconds,
      type: 'custom',
      isActive: true,
    };
    set({
      isActive: true,
      currentSession: session,
      timeRemaining: durationSeconds,
      isBreak: false,
    });
  },

  stopTimer: () => {
    const { currentSession, sessions } = get();
    if (currentSession) {
      const completed = { ...currentSession, endTime: Date.now(), isActive: false };
      set({
        isActive: false,
        currentSession: null,
        sessions: [...sessions, completed],
      });
    } else {
      set({ isActive: false });
    }
  },

  tick: (deltaSeconds) => {
    const { isActive, timeRemaining, isBreak, timerConfig, sessionCount, sessions, currentSession } = get();
    if (!isActive) return;

    const newRemaining = timeRemaining - deltaSeconds;

    if (newRemaining <= 0) {
      if (!isBreak) {
        const newCount = sessionCount + 1;
        const isLongBreak = newCount % timerConfig.sessionsBeforeLongBreak === 0;
        const breakDuration = isLongBreak ? timerConfig.longBreakDuration : timerConfig.breakDuration;

        if (currentSession) {
          const completed = { ...currentSession, endTime: Date.now(), isActive: false };
          set({
            sessions: [...sessions, completed],
            sessionCount: newCount,
          });
        }

        set({
          isBreak: true,
          timeRemaining: breakDuration,
          currentSession: {
            id: Date.now().toString(),
            startTime: Date.now(),
            endTime: null,
            duration: breakDuration,
            type: 'pomodoro',
            isActive: true,
          },
        });
      } else {
        set({
          isBreak: false,
          timeRemaining: timerConfig.workDuration,
          currentSession: {
            id: Date.now().toString(),
            startTime: Date.now(),
            endTime: null,
            duration: timerConfig.workDuration,
            type: 'pomodoro',
            isActive: true,
          },
        });
      }
    } else {
      set({ timeRemaining: newRemaining });
    }
  },

  setTimerConfig: (config) =>
    set((state) => ({
      timerConfig: { ...state.timerConfig, ...config },
    })),

  toggleFullscreen: () => {
    const { isFullscreen } = get();
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    set({ isFullscreen: !isFullscreen });
  },

  toggleMinimalUI: () => set((state) => ({ isMinimalUI: !state.isMinimalUI })),
}));
