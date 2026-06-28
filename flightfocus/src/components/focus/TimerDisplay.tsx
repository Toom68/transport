import { motion, AnimatePresence } from 'framer-motion';
import { useFocusStore } from '@/store/focusStore';

export function TimerDisplay() {
  const isActive = useFocusStore((s) => s.isActive);
  const isPaused = useFocusStore((s) => s.isPaused);
  const isBreak = useFocusStore((s) => s.isBreak);
  const timeRemaining = useFocusStore((s) => s.timeRemaining);
  const currentSession = useFocusStore((s) => s.currentSession);
  const timerConfig = useFocusStore((s) => s.timerConfig);

  const isFreeMode = currentSession?.type === 'free' && !isBreak;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalDuration = currentSession?.duration ?? timerConfig.workDuration;
  const progress = isActive && !isFreeMode ? 1 - timeRemaining / totalDuration : 0;
  const barColor = isBreak ? 'var(--color-gold)' : 'var(--color-accent)';

  return (
    <div className="mb-3 shrink-0">
      {/* Countdown — padded when idle to fill space, compact when active */}
      <motion.div
        className="text-center"
        animate={{ paddingTop: isActive ? 0 : 16, paddingBottom: isActive ? 0 : 16 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.span
          animate={{ opacity: isPaused ? 0.5 : 1 }}
          className="text-6xl font-mono font-bold text-theme-primary tracking-wider"
        >
          {timeDisplay}
        </motion.span>
      </motion.div>

      {/* Progress bar — appears when session starts */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="progress-bar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 5 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="mt-2 rounded-full overflow-hidden bg-white/10"
          >
            <motion.div
              className="h-full rounded-full"
              animate={{ width: isFreeMode ? '100%' : `${progress * 100}%`, backgroundColor: barColor }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
