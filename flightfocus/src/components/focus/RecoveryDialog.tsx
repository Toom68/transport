import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Scissors, AlertCircle, CalendarClock, X } from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';

export function RecoveryDialog() {
  const { pendingRecovery, currentSession, elapsedAtRecovery, recoverSession } = useFocusStore();
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  if (!pendingRecovery || !currentSession) return null;

  const elapsedMin = Math.round(elapsedAtRecovery / 60);
  const totalMin = Math.round(currentSession.duration / 60);
  const remainingMin = totalMin - elapsedMin;

  const handleReschedule = () => {
    if (!rescheduleDate || !rescheduleTime) return;
    const dt = new Date(`${rescheduleDate}T${rescheduleTime}`);
    recoverSession('reschedule', dt.getTime());
    setShowReschedule(false);
  };

  return (
    <AnimatePresence>
      {pendingRecovery && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="mx-4 w-full max-w-sm surface rounded-xl p-5 shadow-xl"
          >
            {!showReschedule ? (
              <>
                <div className="mb-4">
                  <h3 className="text-sm font-serif font-medium text-theme-primary mb-1">
                    Session interrupted
                  </h3>
                  <p className="text-xs text-theme-muted">
                    {elapsedMin} min elapsed · {remainingMin} min remaining
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => recoverSession('resume')}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-theme-accent-soft text-theme-accent text-xs font-medium hover:bg-theme-accent/20 transition-all"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Resume session
                  </button>
                  <button
                    onClick={() => recoverSession('shorten')}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-theme-dim text-theme-secondary text-xs font-medium hover:text-theme-primary transition-all"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    Shorten — save {elapsedMin} min as complete
                  </button>
                  <button
                    onClick={() => recoverSession('interrupt')}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-theme-dim text-theme-secondary text-xs font-medium hover:text-theme-primary transition-all"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Mark as interrupted
                  </button>
                  <button
                    onClick={() => setShowReschedule(true)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-theme-dim text-theme-secondary text-xs font-medium hover:text-theme-primary transition-all"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    Reschedule for later
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <h3 className="text-sm font-serif font-medium text-theme-primary mb-1">
                    Reschedule session
                  </h3>
                  <p className="text-xs text-theme-muted">
                    Pick a time to be reminded to focus again
                  </p>
                </div>
                <div className="space-y-2 mb-4">
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                  />
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReschedule(false)}
                    className="flex-1 px-3 py-2 rounded-lg bg-theme-dim text-theme-secondary text-xs font-medium transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleReschedule}
                    disabled={!rescheduleDate || !rescheduleTime}
                    className="flex-1 px-3 py-2 rounded-lg bg-theme-accent-soft text-theme-accent text-xs font-medium transition-all disabled:opacity-40"
                  >
                    Schedule
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
