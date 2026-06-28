import { Flame, Clock, Target } from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';

export function FocusStats() {
  const sessions = useFocusStore((s) => s.sessions);
  const tasks = useFocusStore((s) => s.tasks);

  const completedSessions = sessions.filter((s) => s.endTime).length;
  const totalFocusMin = Math.round(
    sessions.reduce((sum, s) => sum + (s.endTime ? (s.endTime - s.startTime) / 60000 : 0), 0)
  );

  return (
    <div className="flex items-center gap-4 mb-3 shrink-0 text-xs text-theme-muted">
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
  );
}
