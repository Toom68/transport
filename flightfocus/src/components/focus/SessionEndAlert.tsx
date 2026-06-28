import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusStore } from '@/store/focusStore';
import { playFocusChime } from '@/utils/focusChime';

export function SessionEndAlert() {
  const isBreak = useFocusStore((s) => s.isBreak);
  const isActive = useFocusStore((s) => s.isActive);
  const alertConfig = useFocusStore((s) => s.alertConfig);
  const [showAlert, setShowAlert] = useState(false);
  const [prevIsBreak, setPrevIsBreak] = useState(false);
  const [prevIsActive, setPrevIsActive] = useState(false);

  useEffect(() => {
    // Detect transition from work to break or break to work
    if (isActive && prevIsActive) {
      if (isBreak !== prevIsBreak) {
        // Session ended — trigger alert
        if (alertConfig.soundEnabled) {
          playFocusChime(alertConfig);
        }
        if (alertConfig.visualEnabled) {
          setShowAlert(true);
          const timer = setTimeout(() => setShowAlert(false), 1500);
          return () => clearTimeout(timer);
        }
      }
    }
    setPrevIsBreak(isBreak);
    setPrevIsActive(isActive);
  }, [isBreak, isActive, prevIsBreak, prevIsActive, alertConfig]);

  const message = isBreak ? 'Time for a break' : 'Back to focus';
  const bgColor = isBreak ? 'var(--color-gold)' : 'var(--color-accent)';

  return (
    <AnimatePresence>
      {showAlert && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ backgroundColor: `${bgColor}20` }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="px-6 py-3 rounded-xl backdrop-blur-sm"
            style={{ backgroundColor: `${bgColor}30`, border: `1px solid ${bgColor}50` }}
          >
            <span className="text-lg font-serif font-medium" style={{ color: bgColor }}>
              {message}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
