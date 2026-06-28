import { useState } from 'react';
import { Play, Pause, Square, SkipForward } from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';

const PRESETS = [
  { mins: 15, label: 'Quick' },
  { mins: 25, label: 'Pomodoro' },
  { mins: 45, label: 'Deep' },
  { mins: 90, label: 'Flow' },
];

export function TimerControls() {
  const {
    isActive,
    isPaused,
    isBreak,
    startPomodoro,
    startCustomTimer,
    startFreeSession,
    stopTimer,
    pauseTimer,
    resumeTimer,
    skipBreak,
  } = useFocusStore();

  const [customMinutes, setCustomMinutes] = useState('');

  const handleStartCustom = () => {
    const mins = parseInt(customMinutes, 10);
    if (mins > 0) {
      startCustomTimer(mins);
      setCustomMinutes('');
    }
  };

  if (isActive) {
    return (
      <div className="shrink-0 mb-3 space-y-2">
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
        {isBreak && (
          <button
            onClick={skipBreak}
            className="w-full py-2 text-xs font-medium text-theme-gold hover:text-theme-primary transition-colors flex items-center justify-center gap-1.5"
          >
            <SkipForward className="w-3 h-3" />
            Skip break
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="shrink-0 mb-3">
      <div className="flex gap-2 mb-2">
        {PRESETS.map((p) => (
          <button
            key={p.mins}
            onClick={() => (p.mins === 25 ? startPomodoro() : startCustomTimer(p.mins))}
            className="flex-1 py-2 px-2 bg-theme-dim hover:bg-theme-hover text-theme-secondary text-xs font-medium rounded-full transition-all duration-200 flex flex-col items-center gap-0.5"
          >
            <span className="font-mono font-bold text-sm text-theme-primary">{p.mins}</span>
            <span className="text-xs opacity-70">{p.label}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 mb-2">
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
      <button
        onClick={() => startFreeSession()}
        className="w-full py-2 text-xs font-medium text-theme-secondary hover:text-theme-primary bg-theme-dim hover:bg-theme-hover rounded-lg transition-all duration-200"
      >
        Free Focus (stopwatch)
      </button>
    </div>
  );
}
