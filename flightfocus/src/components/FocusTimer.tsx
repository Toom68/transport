import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Timer, Coffee } from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';
import { useAudioStore } from '@/store/audioStore';

import { TimerDisplay } from '@/components/focus/TimerDisplay';
import { TimerControls } from '@/components/focus/TimerControls';
import { SessionGoal } from '@/components/focus/SessionGoal';
import { TaskList } from '@/components/focus/TaskList';
import { FocusSettings } from '@/components/focus/FocusSettings';
import { FocusStats } from '@/components/focus/FocusStats';
import { FocusHistory } from '@/components/focus/FocusHistory';
import { SessionEndAlert } from '@/components/focus/SessionEndAlert';
import { RecoveryDialog } from '@/components/focus/RecoveryDialog';
import { SmartBreakSuggestion } from '@/components/focus/SmartBreakSuggestion';
import { ScheduledReminders } from '@/components/focus/ScheduledReminders';

export function FocusTimer() {
  const {
    isActive,
    isPaused,
    isBreak,
    sessionCount,
    sessions,
    tick,
    ambientLinkEnabled,
    ambientWorkPreset,
    ambientBreakPreset,
  } = useFocusStore();

  const { setPreset: setAudioPreset } = useAudioStore();

  const [showSettings, setShowSettings] = useState(false);
  const prevIsBreakRef = useRef(false);
  const prevIsActiveRef = useRef(false);

  // Tick interval
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => tick(1), 1000);
    return () => clearInterval(interval);
  }, [isActive, tick]);

  // Ambient sound linking
  useEffect(() => {
    if (!ambientLinkEnabled) return;
    if (isActive && !prevIsActiveRef.current) {
      setAudioPreset(ambientWorkPreset);
    }
    if (isBreak !== prevIsBreakRef.current) {
      setAudioPreset(isBreak ? ambientBreakPreset : ambientWorkPreset);
    }
    prevIsActiveRef.current = isActive;
    prevIsBreakRef.current = isBreak;
  }, [ambientLinkEnabled, isActive, isBreak, ambientWorkPreset, ambientBreakPreset, setAudioPreset]);

  // Keyboard shortcut: Space to pause/resume
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isActive) {
        e.preventDefault();
        const { isPaused, pauseTimer, resumeTimer } = useFocusStore.getState();
        if (isPaused) resumeTimer();
        else pauseTimer();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive]);

  const hasNoSessions = sessions.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative lg:flex-1 lg:min-h-0 max-h-[70vh] lg:max-h-none flex flex-col surface rounded-xl p-4 overflow-y-auto"
    >
      <SessionEndAlert />
      <RecoveryDialog />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          {isBreak ? (
            <Coffee className="w-4 h-4 text-theme-gold" />
          ) : (
            <Timer className="w-4 h-4 text-theme-accent" />
          )}
          <span className="text-base font-serif font-medium text-theme-primary">
            {isBreak ? 'Break' : 'Focus'}
          </span>
          {sessionCount > 0 && (
            <span className="text-xs text-theme-muted">#{sessionCount}</span>
          )}
          {isPaused && (
            <span className="text-xs text-theme-gold italic">paused</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <FocusSettings show={showSettings} onToggle={() => setShowSettings((s) => !s)} />
        </div>
      </div>

      {/* Scheduled reminders */}
      <ScheduledReminders />

      {/* Timer display with progress ring */}
      <TimerDisplay />

      {/* Timer controls */}
      <TimerControls />

      {/* Session goal — collapsible selector before start, display during session */}
      <SessionGoal />

      {/* Smart break suggestion */}
      <SmartBreakSuggestion />

      {/* Session stats */}
      <FocusStats />

      {/* Focus history by subject */}
      <FocusHistory />

      {/* Task list */}
      <TaskList />

      {/* Empty state */}
      {hasNoSessions && !isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-6 shrink-0"
        >
          <p className="text-xs text-theme-muted">
            Start your first focus session above. Set a goal, pick a duration, and begin.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
