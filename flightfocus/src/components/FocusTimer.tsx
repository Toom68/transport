import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Timer, Pause, Play, Square, Maximize, Minimize2, Coffee, Plus, Check, X,
  Wind, Target, Flame, Clock, Settings, ChevronDown, Volume2,
} from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';
import { useAudioStore, AUDIO_PRESETS } from '@/store/audioStore';
import type { AudioPreset } from '@/types/simulation';

const PRESETS = [
  { mins: 15, label: 'Quick' },
  { mins: 25, label: 'Pomodoro' },
  { mins: 45, label: 'Deep' },
  { mins: 90, label: 'Flow' },
];

const BREATHING_PHASES = [
  { label: 'Inhale', duration: 4, color: 'text-theme-accent' },
  { label: 'Hold', duration: 4, color: 'text-theme-gold' },
  { label: 'Exhale', duration: 6, color: 'text-cyan-500' },
] as const;

const AMBIENT_PRESET_OPTIONS: Exclude<AudioPreset, 'auto'>[] = ['focus', 'night', 'stormy', 'takeoff', 'silent', 'roadTrip', 'nightDrive', 'cityTraffic'];

export function FocusTimer() {
  const {
    isActive,
    isPaused,
    timeRemaining,
    isBreak,
    sessionCount,
    sessions,
    tasks,
    timerConfig,
    isMinimalUI,
    tasksExpanded,
    breathingExpanded,
    ambientLinkEnabled,
    ambientWorkPreset,
    ambientBreakPreset,
    startPomodoro,
    startCustomTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    tick,
    toggleFullscreen,
    toggleMinimalUI,
    setTimerConfig,
    addTask,
    toggleTask,
    removeTask,
    toggleTasksExpanded,
    toggleBreathingExpanded,
    setAmbientLinkEnabled,
    setAmbientWorkPreset,
    setAmbientBreakPreset,
  } = useFocusStore();

  const { setPreset: setAudioPreset } = useAudioStore();

  const [taskInput, setTaskInput] = useState('');
  const [breathing, setBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState(0);
  const [breathCount, setBreathCount] = useState(0);
  const [customMinutes, setCustomMinutes] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const prevIsBreakRef = useRef(false);
  const prevIsActiveRef = useRef(false);

  // Tick interval — runs regardless of pause; store ignores ticks when paused
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => tick(1), 1000);
    return () => clearInterval(interval);
  }, [isActive, tick]);

  // Ambient sound linking — switch preset on session start / break transition
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

  // Breathing animation cycle
  useEffect(() => {
    if (!breathing) return;
    const phase = BREATHING_PHASES[breathPhase];
    const timer = setTimeout(() => {
      const next = (breathPhase + 1) % BREATHING_PHASES.length;
      setBreathPhase(next);
      setBreathCount((c) => (next === 0 ? c + 1 : c));
    }, phase.duration * 1000);
    return () => clearTimeout(timer);
  }, [breathing, breathPhase]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Fix: use currentSession duration instead of hardcoded values
  const totalDuration = useFocusStore((s) => s.currentSession?.duration) ?? timerConfig.workDuration;
  const progress = isActive ? 1 - timeRemaining / totalDuration : 0;

  const completedSessions = sessions.filter((s) => s.endTime).length;
  const totalFocusMin = Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / 60);

  const handleAddTask = () => {
    if (!taskInput.trim()) return;
    addTask(taskInput);
    setTaskInput('');
  };

  const handleStartCustom = () => {
    const mins = parseInt(customMinutes, 10);
    if (mins > 0) {
      startCustomTimer(mins);
      setCustomMinutes('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="lg:flex-1 lg:min-h-0 max-h-[70vh] lg:max-h-none flex flex-col surface rounded-xl p-5 overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
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
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={`p-1.5 rounded hover:bg-theme-dim transition-colors ${showSettings ? 'text-theme-accent' : 'text-theme-muted'}`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleMinimalUI}
            className="p-1.5 rounded hover:bg-theme-dim text-theme-muted transition-colors"
          >
            {isMinimalUI ? <Maximize className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Settings popover */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="space-y-3 p-3 mb-4 surface-soft rounded-lg">
              {/* Timer config */}
              <p className="text-[10px] uppercase tracking-wider text-theme-muted">Timer Durations (minutes)</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-theme-secondary">Work</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(timerConfig.workDuration / 60)}
                    onChange={(e) => setTimerConfig({ workDuration: parseInt(e.target.value, 10) * 60 || 60 })}
                    className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-theme-secondary">Break</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(timerConfig.breakDuration / 60)}
                    onChange={(e) => setTimerConfig({ breakDuration: parseInt(e.target.value, 10) * 60 || 60 })}
                    className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-theme-secondary">Long Break</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(timerConfig.longBreakDuration / 60)}
                    onChange={(e) => setTimerConfig({ longBreakDuration: parseInt(e.target.value, 10) * 60 || 60 })}
                    className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-theme-secondary">Sessions / Long Break</span>
                  <input
                    type="number"
                    min={1}
                    value={timerConfig.sessionsBeforeLongBreak}
                    onChange={(e) => setTimerConfig({ sessionsBeforeLongBreak: parseInt(e.target.value, 10) || 1 })}
                    className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                  />
                </label>
              </div>

              {/* Ambient sound linking */}
              <div className="pt-2 border-t border-theme-border">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-1.5 text-xs text-theme-secondary">
                    <Volume2 className="w-3.5 h-3.5 text-theme-accent" />
                    Link ambient sound
                  </span>
                  <button
                    onClick={() => setAmbientLinkEnabled(!ambientLinkEnabled)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${ambientLinkEnabled ? 'bg-theme-accent' : 'bg-theme-disabled-bg'}`}
                  >
                    <motion.span
                      layout
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                      animate={{ left: ambientLinkEnabled ? '18px' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </label>
                {ambientLinkEnabled && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-theme-secondary">Work preset</span>
                      <select
                        value={ambientWorkPreset}
                        onChange={(e) => setAmbientWorkPreset(e.target.value as AudioPreset)}
                        className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                      >
                        {AMBIENT_PRESET_OPTIONS.map((p) => (
                          <option key={p} value={p}>{AUDIO_PRESETS[p]?.label ?? p}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-theme-secondary">Break preset</span>
                      <select
                        value={ambientBreakPreset}
                        onChange={(e) => setAmbientBreakPreset(e.target.value as AudioPreset)}
                        className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                      >
                        {AMBIENT_PRESET_OPTIONS.map((p) => (
                          <option key={p} value={p}>{AUDIO_PRESETS[p]?.label ?? p}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>

              {/* Fullscreen toggle */}
              <div className="pt-2 border-t border-theme-border">
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 text-xs text-theme-secondary hover:text-theme-primary transition-colors"
                >
                  <Maximize className="w-3.5 h-3.5" />
                  Enter fullscreen
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Big timer display */}
      <div className="relative mb-5 shrink-0">
        <div className="text-center">
          <motion.span
            key={timeDisplay}
            animate={{ opacity: isPaused ? 0.5 : 1 }}
            className="text-6xl font-mono font-bold text-theme-primary tracking-wider"
          >
            {timeDisplay}
          </motion.span>
        </div>
        <div className="mt-4 h-1.5 bg-theme-disabled-bg rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ width: `${progress * 100}%`, backgroundColor: isBreak ? 'var(--color-gold)' : 'var(--color-accent)' }}
          />
        </div>
      </div>

      {/* Session stats — inline */}
      <div className="flex items-center gap-4 mb-5 shrink-0 text-xs text-theme-muted">
        <span className="flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-theme-gold" />
          <span className="font-mono text-theme-primary">{completedSessions}</span> sessions
        </span>
        <span className="flex items-center gap-1.5 border-l border-theme-border pl-4">
          <Clock className="w-3.5 h-3.5 text-theme-accent" />
          <span className="font-mono text-theme-primary">{totalFocusMin}</span> min
        </span>
        <span className="flex items-center gap-1.5 border-l border-theme-border pl-4">
          <Target className="w-3.5 h-3.5 text-theme-accent" />
          <span className="font-mono text-theme-primary">{tasks.filter((t) => t.done).length}/{tasks.length}</span> tasks
        </span>
      </div>

      {/* Timer controls */}
      <div className="shrink-0 mb-4">
        {!isActive ? (
          <>
            <div className="flex gap-2 mb-2">
              {PRESETS.map((p) => (
                <button
                  key={p.mins}
                  onClick={() => p.mins === 25 ? startPomodoro() : startCustomTimer(p.mins)}
                  className="flex-1 py-2 px-2 bg-theme-dim hover:bg-theme-hover text-theme-secondary text-xs font-medium rounded-full transition-all duration-200 flex flex-col items-center gap-0.5"
                >
                  <span className="font-mono font-bold text-sm text-theme-primary">{p.mins}</span>
                  <span className="text-xs opacity-70">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="number"
                min={1}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartCustom()}
                placeholder="Custom (min)"
                className="flex-1 px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border transition-all"
              />
              <button
                onClick={handleStartCustom}
                disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
                className="px-3 py-2 rounded-lg bg-theme-accent-soft text-theme-accent text-xs font-medium transition-all duration-200 disabled:opacity-40 shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={isPaused ? resumeTimer : pauseTimer}
              className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                isPaused
                  ? 'bg-theme-accent-soft text-theme-accent hover:bg-theme-accent/20'
                  : 'bg-theme-dim text-theme-secondary hover:text-theme-primary'
              }`}
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={stopTimer}
              className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5"
            >
              <Square className="w-3 h-3" />
              End
            </button>
          </div>
        )}
      </div>

      {/* Breathing exercise — collapsible */}
      <div className="shrink-0 mb-4">
        <button
          onClick={toggleBreathingExpanded}
          className="w-full flex items-center justify-between py-2 text-xs font-medium text-theme-secondary hover:text-theme-primary transition-colors"
        >
          <span className="flex items-center gap-2">
            <Wind className="w-3.5 h-3.5" />
            {breathing ? `Breathing · ${breathCount} cycles` : 'Box Breathing'}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${breathingExpanded ? '' : '-rotate-90'}`} />
        </button>
        <AnimatePresence>
          {breathingExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col items-center pt-3 pb-2">
                <button
                  onClick={() => { setBreathing(!breathing); setBreathPhase(0); setBreathCount(0); }}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    breathing ? 'bg-theme-accent-soft text-theme-accent' : 'bg-theme-dim text-theme-secondary hover:text-theme-primary'
                  }`}
                >
                  {breathing ? 'Stop' : 'Start breathing'}
                </button>
                <AnimatePresence>
                  {breathing && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex flex-col items-center pt-4"
                    >
                      <motion.div
                        animate={{
                          scale: breathPhase === 0 ? [1, 1.4] : breathPhase === 2 ? [1.4, 1] : 1.4,
                          transition: { duration: BREATHING_PHASES[breathPhase].duration, ease: 'easeInOut' },
                        }}
                        className="w-16 h-16 rounded-full bg-theme-accent-soft border-2 border-theme-accent-border flex items-center justify-center"
                      >
                        <span className={`text-xs font-medium ${BREATHING_PHASES[breathPhase].color}`}>
                          {BREATHING_PHASES[breathPhase].label}
                        </span>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Task list — collapsible */}
      <div className="flex-1 min-h-0 flex flex-col">
        <button
          onClick={toggleTasksExpanded}
          className="flex items-center justify-between w-full mb-2 shrink-0 py-1"
        >
          <span className="flex items-center gap-2 text-xs font-medium text-theme-secondary">
            <Target className="w-3.5 h-3.5 text-theme-muted" />
            Tasks
            <span className="text-theme-muted font-mono">({tasks.filter((t) => t.done).length}/{tasks.length})</span>
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform ${tasksExpanded ? '' : '-rotate-90'}`} />
        </button>
        <AnimatePresence>
          {tasksExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden flex-1 min-h-0 flex flex-col"
            >
              <div className="flex gap-1.5 mb-2 shrink-0">
                <input
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                  placeholder="Add a focus task…"
                  className="flex-1 px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border transition-all"
                />
                <button
                  onClick={handleAddTask}
                  className="w-8 h-8 rounded-lg bg-theme-accent-soft text-theme-accent flex items-center justify-center transition-all duration-200 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
                {tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 group p-2.5 rounded-lg surface-soft hover:border-theme-border-solid transition-all duration-200"
                  >
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all ${
                        task.done ? 'bg-theme-accent text-white' : 'border border-theme-border-solid hover:border-theme-accent-border'
                      }`}
                    >
                      {task.done && <Check className="w-3 h-3" />}
                    </button>
                    <span className={`flex-1 text-xs ${task.done ? 'text-theme-muted line-through' : 'text-theme-primary'}`}>
                      {task.text}
                    </span>
                    <button
                      onClick={() => removeTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-theme-muted hover:text-red-500 transition-all shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
                {tasks.length === 0 && (
                  <p className="text-xs text-theme-muted text-center py-4">No tasks yet. Add one above.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
