import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FocusSession, FocusTask, TimerConfig, AudioPreset,
  FocusGoal, FocusAlertConfig, ScheduledSession,
  SubjectBreakdownEntry, BreakRecommendation, InterruptReason,
} from '@/types/simulation';
import { getSubjectColor } from '@/utils/subjectColor';

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

  // Goal & recovery
  currentGoal: FocusGoal | null;
  pendingRecovery: boolean;
  elapsedAtRecovery: number;

  // Alerts
  alertConfig: FocusAlertConfig;

  // Scheduling
  scheduledSessions: ScheduledSession[];

  // Subject history
  recentSubjects: string[];

  // Ambient sound linking
  ambientLinkEnabled: boolean;
  ambientWorkPreset: AudioPreset;
  ambientBreakPreset: AudioPreset;

  // Section collapse state
  tasksExpanded: boolean;
  breathingExpanded: boolean;
  historyExpanded: boolean;

  startPomodoro: (goal?: FocusGoal) => void;
  startCustomTimer: (durationMinutes: number, goal?: FocusGoal) => void;
  startFreeSession: (goal?: FocusGoal) => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  tick: (deltaSeconds: number) => void;
  setTimerConfig: (config: Partial<TimerConfig>) => void;
  toggleFullscreen: () => void;
  toggleMinimalUI: () => void;

  skipBreak: () => void;
  setBreakDuration: (seconds: number) => void;

  setCurrentGoal: (goal: FocusGoal | null) => void;
  recoverSession: (action: 'resume' | 'shorten' | 'interrupt' | 'reschedule', rescheduleFor?: number) => void;

  scheduleSession: (session: ScheduledSession) => void;
  removeScheduledSession: (id: string) => void;
  markReminderShown: (id: string) => void;
  startScheduledSession: (id: string) => void;

  setAlertConfig: (config: Partial<FocusAlertConfig>) => void;

  getSubjectBreakdown: (timeRange?: 'today' | 'all') => SubjectBreakdownEntry[];
  getRecentLoad: (minutesBack: number) => number;
  recommendBreakDuration: () => BreakRecommendation;

  addTask: (text: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;

  setAmbientLinkEnabled: (enabled: boolean) => void;
  setAmbientWorkPreset: (preset: AudioPreset) => void;
  setAmbientBreakPreset: (preset: AudioPreset) => void;

  toggleTasksExpanded: () => void;
  toggleBreathingExpanded: () => void;
  toggleHistoryExpanded: () => void;
}

function addRecentSubject(subjects: string[], newSubject: string): string[] {
  const trimmed = newSubject.trim();
  if (!trimmed) return subjects;
  const filtered = subjects.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
  return [trimmed, ...filtered].slice(0, 20);
}

function isSessionToday(session: FocusSession): boolean {
  if (!session.endTime) return false;
  const now = new Date();
  const end = new Date(session.endTime);
  return now.getFullYear() === end.getFullYear() &&
    now.getMonth() === end.getMonth() &&
    now.getDate() === end.getDate();
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

      currentGoal: null,
      pendingRecovery: false,
      elapsedAtRecovery: 0,

      alertConfig: {
        soundEnabled: true,
        visualEnabled: true,
        chimeType: 'bell',
      },

      scheduledSessions: [],

      recentSubjects: [],

      ambientLinkEnabled: false,
      ambientWorkPreset: 'focus',
      ambientBreakPreset: 'silent',

      tasksExpanded: true,
      breathingExpanded: false,
      historyExpanded: false,

      setCurrentGoal: (goal) => set({ currentGoal: goal }),

      startPomodoro: (goal) => {
        const { timerConfig, currentGoal } = get();
        const sessionGoal = goal ?? currentGoal;
        const session: FocusSession = {
          id: Date.now().toString(),
          startTime: Date.now(),
          endTime: null,
          duration: timerConfig.workDuration,
          type: 'pomodoro',
          isActive: true,
          goal: sessionGoal ?? undefined,
          completedTasks: [],
        };
        set({
          isActive: true,
          isPaused: false,
          currentSession: session,
          timeRemaining: timerConfig.workDuration,
          isBreak: false,
          pendingRecovery: false,
        });
      },

      startCustomTimer: (durationMinutes, goal) => {
        const { currentGoal } = get();
        const sessionGoal = goal ?? currentGoal;
        const durationSeconds = durationMinutes * 60;
        const session: FocusSession = {
          id: Date.now().toString(),
          startTime: Date.now(),
          endTime: null,
          duration: durationSeconds,
          type: 'custom',
          isActive: true,
          goal: sessionGoal ?? undefined,
          completedTasks: [],
        };
        set({
          isActive: true,
          isPaused: false,
          currentSession: session,
          timeRemaining: durationSeconds,
          isBreak: false,
          pendingRecovery: false,
        });
      },

      startFreeSession: (goal) => {
        const { currentGoal } = get();
        const sessionGoal = goal ?? currentGoal;
        const session: FocusSession = {
          id: Date.now().toString(),
          startTime: Date.now(),
          endTime: null,
          duration: 0,
          type: 'free',
          isActive: true,
          goal: sessionGoal ?? undefined,
          completedTasks: [],
        };
        set({
          isActive: true,
          isPaused: false,
          currentSession: session,
          timeRemaining: 0,
          isBreak: false,
          pendingRecovery: false,
        });
      },

      stopTimer: () => {
        const { currentSession, isBreak } = get();
        // Breaks can be stopped without recovery
        if (isBreak || !currentSession) {
          const { sessions } = get();
          if (currentSession) {
            const completed = { ...currentSession, endTime: Date.now(), isActive: false };
            set({
              isActive: false,
              isPaused: false,
              currentSession: null,
              sessions: [...sessions, completed],
              isBreak: false,
            });
          } else {
            set({ isActive: false, isPaused: false, isBreak: false });
          }
          return;
        }

        // For free mode, no recovery needed — just save elapsed time
        if (currentSession.type === 'free') {
          const { sessions } = get();
          const elapsed = Math.round((Date.now() - currentSession.startTime) / 1000);
          const completed: FocusSession = {
            ...currentSession,
            endTime: Date.now(),
            duration: elapsed,
            isActive: false,
          };
          const newSubjects = currentSession.goal
            ? addRecentSubject(get().recentSubjects, currentSession.goal.subject)
            : get().recentSubjects;
          set({
            isActive: false,
            isPaused: false,
            currentSession: null,
            sessions: [...sessions, completed],
            recentSubjects: newSubjects,
          });
          return;
        }

        // For timed sessions, check if completed naturally
        const elapsed = Math.round((Date.now() - currentSession.startTime) / 1000);
        const isComplete = elapsed >= currentSession.duration;

        if (isComplete) {
          const { sessions } = get();
          const completed = { ...currentSession, endTime: Date.now(), isActive: false };
          const newSubjects = currentSession.goal
            ? addRecentSubject(get().recentSubjects, currentSession.goal.subject)
            : get().recentSubjects;
          set({
            isActive: false,
            isPaused: false,
            currentSession: null,
            sessions: [...sessions, completed],
            recentSubjects: newSubjects,
          });
        } else {
          // Trigger recovery flow
          set({ pendingRecovery: true, elapsedAtRecovery: elapsed });
        }
      },

      recoverSession: (action, rescheduleFor) => {
        const { currentSession, sessions, elapsedAtRecovery, recentSubjects } = get();
        if (!currentSession) return;

        if (action === 'resume') {
          set({ pendingRecovery: false });
          return;
        }

        const now = Date.now();
        const newSubjects = currentSession.goal
          ? addRecentSubject(recentSubjects, currentSession.goal.subject)
          : recentSubjects;

        if (action === 'shorten') {
          const completed: FocusSession = {
            ...currentSession,
            endTime: now,
            duration: elapsedAtRecovery,
            isActive: false,
          };
          set({
            isActive: false,
            isPaused: false,
            currentSession: null,
            pendingRecovery: false,
            sessions: [...sessions, completed],
            recentSubjects: newSubjects,
          });
        } else if (action === 'interrupt') {
          const completed: FocusSession = {
            ...currentSession,
            endTime: now,
            duration: elapsedAtRecovery,
            isActive: false,
            interrupted: true,
            interruptReason: 'interrupted' as InterruptReason,
          };
          set({
            isActive: false,
            isPaused: false,
            currentSession: null,
            pendingRecovery: false,
            sessions: [...sessions, completed],
            recentSubjects: newSubjects,
          });
        } else if (action === 'reschedule') {
          const completed: FocusSession = {
            ...currentSession,
            endTime: now,
            duration: elapsedAtRecovery,
            isActive: false,
            interrupted: true,
            interruptReason: 'rescheduled' as InterruptReason,
          };
          const scheduled: ScheduledSession | null = rescheduleFor
            ? {
                id: Date.now().toString() + '-sched',
                goal: currentSession.goal ?? { type: 'custom', subject: 'General', detail: '' },
                duration: currentSession.duration,
                scheduledFor: rescheduleFor,
                reminderShown: false,
              }
            : null;
          set({
            isActive: false,
            isPaused: false,
            currentSession: null,
            pendingRecovery: false,
            sessions: [...sessions, completed],
            recentSubjects: newSubjects,
            scheduledSessions: scheduled
              ? [...get().scheduledSessions, scheduled]
              : get().scheduledSessions,
          });
        }
      },

      skipBreak: () => {
        const { timerConfig, currentGoal } = get();
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
            goal: currentGoal ?? undefined,
            completedTasks: [],
          },
        });
      },

      setBreakDuration: (seconds) => {
        const { currentSession } = get();
        set({
          timeRemaining: seconds,
          currentSession: currentSession
            ? { ...currentSession, duration: seconds }
            : null,
        });
      },

      pauseTimer: () => set({ isPaused: true }),

      resumeTimer: () => set({ isPaused: false }),

      tick: (deltaSeconds) => {
        const { isActive, isPaused, timeRemaining, isBreak, timerConfig, sessionCount, sessions, currentSession } = get();
        if (!isActive || isPaused || !currentSession) return;

        // Free mode — count up instead of down
        if (currentSession.type === 'free' && !isBreak) {
          set({ timeRemaining: timeRemaining + deltaSeconds });
          return;
        }

        const newRemaining = timeRemaining - deltaSeconds;

        if (newRemaining <= 0) {
          if (!isBreak) {
            const newCount = sessionCount + 1;
            const isLongBreak = newCount % timerConfig.sessionsBeforeLongBreak === 0;
            const breakDuration = isLongBreak ? timerConfig.longBreakDuration : timerConfig.breakDuration;

            if (currentSession) {
              const completed = { ...currentSession, endTime: Date.now(), isActive: false };
              const newSubjects = currentSession.goal
                ? addRecentSubject(get().recentSubjects, currentSession.goal.subject)
                : get().recentSubjects;
              set({
                sessions: [...sessions, completed],
                sessionCount: newCount,
                recentSubjects: newSubjects,
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
                completedTasks: [],
              },
            });
          } else {
            const { currentGoal } = get();
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
                goal: currentGoal ?? undefined,
                completedTasks: [],
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

      setAlertConfig: (config) =>
        set((state) => ({ alertConfig: { ...state.alertConfig, ...config } })),

      scheduleSession: (session) =>
        set((state) => ({
          scheduledSessions: [...state.scheduledSessions, session],
        })),

      removeScheduledSession: (id) =>
        set((state) => ({
          scheduledSessions: state.scheduledSessions.filter((s) => s.id !== id),
        })),

      markReminderShown: (id) =>
        set((state) => ({
          scheduledSessions: state.scheduledSessions.map((s) =>
            s.id === id ? { ...s, reminderShown: true } : s
          ),
        })),

      startScheduledSession: (id) => {
        const { scheduledSessions } = get();
        const scheduled = scheduledSessions.find((s) => s.id === id);
        if (!scheduled) return;
        const durationSeconds = scheduled.duration;
        const session: FocusSession = {
          id: Date.now().toString(),
          startTime: Date.now(),
          endTime: null,
          duration: durationSeconds,
          type: durationSeconds === 25 * 60 ? 'pomodoro' : 'custom',
          isActive: true,
          goal: scheduled.goal,
          completedTasks: [],
        };
        set({
          isActive: true,
          isPaused: false,
          currentSession: session,
          timeRemaining: durationSeconds,
          isBreak: false,
          currentGoal: scheduled.goal,
          scheduledSessions: scheduledSessions.filter((s) => s.id !== id),
        });
      },

      getSubjectBreakdown: (timeRange) => {
        const { sessions } = get();
        const filtered = sessions.filter((s) => {
          if (!s.endTime || !s.goal) return false;
          if (timeRange === 'today' && !isSessionToday(s)) return false;
          return true;
        });

        const map = new Map<string, { minutes: number; sessionCount: number }>();
        for (const s of filtered) {
          const subject = s.goal!.subject;
          const minutes = Math.round((s.endTime! - s.startTime) / 60000);
          const existing = map.get(subject) ?? { minutes: 0, sessionCount: 0 };
          map.set(subject, {
            minutes: existing.minutes + minutes,
            sessionCount: existing.sessionCount + 1,
          });
        }

        return Array.from(map.entries())
          .map(([subject, { minutes, sessionCount }]) => ({
            subject,
            minutes,
            sessionCount,
            color: getSubjectColor(subject),
          }))
          .sort((a, b) => b.minutes - a.minutes);
      },

      getRecentLoad: (minutesBack) => {
        const { sessions } = get();
        const cutoff = Date.now() - minutesBack * 60 * 1000;
        return sessions
          .filter((s) => s.endTime && s.endTime >= cutoff && !s.interrupted)
          .reduce((sum, s) => sum + Math.round((s.endTime! - s.startTime) / 60000), 0);
      },

      recommendBreakDuration: () => {
        const { currentSession } = get();
        const recentLoad = get().getRecentLoad(120);
        const sessionDurationMin = currentSession
          ? Math.round(currentSession.duration / 60)
          : 25;

        if (sessionDurationMin > 45 || recentLoad > 90) {
          return {
            minutes: 20,
            reason: `You've focused ${recentLoad} min in the last 2h — try a longer break`,
          };
        }
        if (sessionDurationMin >= 25 || recentLoad >= 45) {
          return {
            minutes: 10,
            reason: `You've focused ${recentLoad} min in the last 2h — a 10 min break should recharge you`,
          };
        }
        return {
          minutes: 5,
          reason: 'Short session — a quick 5 min break is fine',
        };
      },

      toggleTasksExpanded: () => set((state) => ({ tasksExpanded: !state.tasksExpanded })),
      toggleBreathingExpanded: () => set((state) => ({ breathingExpanded: !state.breathingExpanded })),
      toggleHistoryExpanded: () => set((state) => ({ historyExpanded: !state.historyExpanded })),
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
        historyExpanded: state.historyExpanded,
        alertConfig: state.alertConfig,
        scheduledSessions: state.scheduledSessions,
        recentSubjects: state.recentSubjects,
      }),
    }
  )
);
