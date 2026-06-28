import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, ChevronDown } from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function FocusHistory() {
  const { getSubjectBreakdown, historyExpanded, toggleHistoryExpanded } = useFocusStore();
  const [timeRange, setTimeRange] = useState<'today' | 'all'>('all');

  const breakdown = getSubjectBreakdown(timeRange);
  const maxMinutes = breakdown.length > 0 ? breakdown[0].minutes : 0;

  return (
    <div className="shrink-0 mb-3">
      <button
        onClick={toggleHistoryExpanded}
        className="w-full flex items-center justify-between py-2 text-xs font-medium text-theme-secondary hover:text-theme-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5" />
          Focus History
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${historyExpanded ? '' : '-rotate-90'}`} />
      </button>
      <AnimatePresence>
        {historyExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 pb-1">
              {/* Time range toggle */}
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => setTimeRange('today')}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-all ${
                    timeRange === 'today'
                      ? 'bg-theme-accent-soft text-theme-accent'
                      : 'bg-theme-dim text-theme-muted'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setTimeRange('all')}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-all ${
                    timeRange === 'all'
                      ? 'bg-theme-accent-soft text-theme-accent'
                      : 'bg-theme-dim text-theme-muted'
                  }`}
                >
                  All time
                </button>
              </div>

              {breakdown.length === 0 ? (
                <p className="text-xs text-theme-muted text-center py-4">
                  No focus history yet. Start a session with a goal to see your breakdown.
                </p>
              ) : (
                <div className="space-y-2">
                  {breakdown.map((entry) => (
                    <div key={entry.subject} className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-xs text-theme-secondary w-20 shrink-0 truncate">
                        {entry.subject}
                      </span>
                      <div className="flex-1 h-2 bg-theme-disabled-bg rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: entry.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${maxMinutes > 0 ? (entry.minutes / maxMinutes) * 100 : 0}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="text-xs font-mono text-theme-primary shrink-0 w-12 text-right">
                        {formatDuration(entry.minutes)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
