import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, Play, X, Bell } from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';
import { getSubjectColor } from '@/utils/subjectColor';

export function ScheduledReminders() {
  const {
    scheduledSessions,
    startScheduledSession,
    removeScheduledSession,
    markReminderShown,
  } = useFocusStore();

  const [dueReminders, setDueReminders] = useState<string[]>([]);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const due = scheduledSessions
        .filter((s) => !s.reminderShown && s.scheduledFor <= now)
        .map((s) => s.id);
      if (due.length > 0) {
        setDueReminders(due);
        due.forEach((id) => markReminderShown(id));
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [scheduledSessions, markReminderShown]);

  const dueSessions = scheduledSessions.filter((s) => dueReminders.includes(s.id));

  return (
    <AnimatePresence>
      {dueSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-3 shrink-0 space-y-2"
        >
          {dueSessions.map((session) => {
            const color = getSubjectColor(session.goal.subject);
            return (
              <div
                key={session.id}
                className="flex items-center gap-2 p-3 surface-soft rounded-lg border border-theme-accent/30"
              >
                <Bell className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-medium text-theme-primary truncate">
                      {session.goal.subject}
                    </span>
                  </div>
                  <span className="text-[10px] text-theme-muted">
                    Scheduled session · {Math.round(session.duration / 60)} min
                  </span>
                </div>
                <button
                  onClick={() => {
                    startScheduledSession(session.id);
                    setDueReminders((prev) => prev.filter((id) => id !== session.id));
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-theme-accent-soft text-theme-accent text-xs font-medium transition-all shrink-0 flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  Start
                </button>
                <button
                  onClick={() => {
                    removeScheduledSession(session.id);
                    setDueReminders((prev) => prev.filter((id) => id !== session.id));
                  }}
                  className="text-theme-muted hover:text-red-500 transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
