import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Timer, Play, Square, Maximize, Minimize2, Coffee, Plus, Check, X,
  Wind, Target, Flame, Clock,
} from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';

interface Task {
  id: string;
  text: string;
  done: boolean;
}

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

export function FocusTimer() {
  const {
    isActive,
    timeRemaining,
    isBreak,
    sessionCount,
    sessions,
    isMinimalUI,
    startPomodoro,
    startCustomTimer,
    stopTimer,
    tick,
    toggleFullscreen,
    toggleMinimalUI,
  } = useFocusStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [breathing, setBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState(0);
  const [breathCount, setBreathCount] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => tick(1), 1000);
    return () => clearInterval(interval);
  }, [isActive, tick]);

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

  const totalDuration = isBreak ? 5 * 60 : 25 * 60;
  const progress = isActive ? 1 - timeRemaining / totalDuration : 0;

  const completedSessions = sessions.filter((s) => s.endTime).length;
  const totalFocusMin = Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / 60);

  const addTask = () => {
    const text = taskInput.trim();
    if (!text) return;
    setTasks((t) => [...t, { id: Date.now().toString(), text, done: false }]);
    setTaskInput('');
  };

  const toggleTask = (id: string) =>
    setTasks((t) => t.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));

  const removeTask = (id: string) =>
    setTasks((t) => t.filter((task) => task.id !== id));

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
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMinimalUI}
            className="p-1.5 rounded hover:bg-theme-dim text-theme-muted transition-colors"
          >
            {isMinimalUI ? <Maximize className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-theme-dim text-theme-muted transition-colors"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Big timer display */}
      <div className="relative mb-5 shrink-0">
        <div className="text-center">
          <motion.span
            key={timeDisplay}
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
          <div className="flex gap-2">
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
        ) : (
          <button
            onClick={stopTimer}
            className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5"
          >
            <Square className="w-3 h-3" />
            End Session
          </button>
        )}
      </div>

      {/* Breathing exercise */}
      <div className="shrink-0 mb-4">
        <button
          onClick={() => { setBreathing(!breathing); setBreathPhase(0); setBreathCount(0); }}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
            breathing ? 'bg-theme-accent-soft text-theme-accent' : 'bg-theme-dim text-theme-secondary hover:text-theme-primary'
          }`}
        >
          <Wind className="w-3.5 h-3.5" />
          {breathing ? `Breathing · ${breathCount} cycles` : 'Box Breathing'}
        </button>
        <AnimatePresence>
          {breathing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col items-center pt-4 pb-2">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Task list */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <Target className="w-3.5 h-3.5 text-theme-muted" />
          <span className="text-xs font-medium text-theme-secondary">Tasks</span>
        </div>
        <div className="flex gap-1.5 mb-2 shrink-0">
          <input
            type="text"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Add a focus task…"
            className="flex-1 px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border transition-all"
          />
          <button
            onClick={addTask}
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
      </div>
    </motion.div>
  );
}
