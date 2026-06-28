import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FocusSession, FocusTask, TimerConfig, AudioPreset } from '@/types/simulation';

interface FocusStore {
  isActive: boolean;
  isPaused: boolean;
  currentSession: FocusSession | null;
  sessions: FocusSession[];
  tasks: FocusTask[];
  timerConfig: TimerConfig;
  timeRemaining: number;
  isBreak: boolean;
  sessionCount: number;
  isFullscreen: boolean;
  isMinimalUI: boolean;

  // Ambient sound linking
  ambientLinkEnabled: boolean;
  ambientWorkPreset: AudioPreset;
  ambientBreakPreset: AudioPreset;

  // Section collapse state
  tasksExpanded: boolean;
  breathingExpanded: boolean;

  startPomodoro: () => void;
  startCustomTimer: (durationMinutes: number) => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  tick: (deltaSeconds: number) => void;
  setTimerConfig: (config: Partial<TimerConfig>) => void;
  toggleFullscreen: () => void;
  toggleMinimalUI: () => void;

  addTask: (text: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;

  setAmbientLinkEnabled: (enabled: boolean) => void;
  setAmbientWorkPreset: (preset: AudioPreset) => void;
  setAmbientBreakPreset: (preset: AudioPreset) => void;

  toggleTasksExpanded: () => void;
  toggleBreathingExpanded: () => void;
}

export const useFocusStore = create<FocusStore>()(
  persist(
    (set, get) => ({
      isActive: false,
      isPaused: false,
      currentSession: null,
      sessions: [],
      tasks: [],
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

      ambientLinkEnabled: false,
      ambientWorkPreset: 'focus',
      ambientBreakPreset: 'silent',

      tasksExpanded: true,
      breathingExpanded: false,

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
          isPaused: false,
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
          isPaused: false,
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
            isPaused: false,
            currentSession: null,
            sessions: [...sessions, completed],
          });
        } else {
          set({ isActive: false, isPaused: false });
        }
      },

      pauseTimer: () => set({ isPaused: true }),

      resumeTimer: () => set({ isPaused: false }),

      tick: (deltaSeconds) => {
        const { isActive, isPaused, timeRemaining, isBreak, timerConfig, sessionCount, sessions, currentSession } = get();
        if (!isActive || isPaused) return;

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

      addTask: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        set((state) => ({
          tasks: [...state.tasks, { id: Date.now().toString(), text: trimmed, done: false }],
        }));
      },

      toggleTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),

      removeTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        })),

      setAmbientLinkEnabled: (enabled) => set({ ambientLinkEnabled: enabled }),
      setAmbientWorkPreset: (preset) => set({ ambientWorkPreset: preset }),
      setAmbientBreakPreset: (preset) => set({ ambientBreakPreset: preset }),

      toggleTasksExpanded: () => set((state) => ({ tasksExpanded: !state.tasksExpanded })),
      toggleBreathingExpanded: () => set((state) => ({ breathingExpanded: !state.breathingExpanded })),
    }),
    {
      name: 'flightfocus-focus',
      partialize: (state) => ({
        sessions: state.sessions,
        tasks: state.tasks,
        timerConfig: state.timerConfig,
        sessionCount: state.sessionCount,
        ambientLinkEnabled: state.ambientLinkEnabled,
        ambientWorkPreset: state.ambientWorkPreset,
        ambientBreakPreset: state.ambientBreakPreset,
        tasksExpanded: state.tasksExpanded,
        breathingExpanded: state.breathingExpanded,
      }),
    }
  )
);
