import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, X } from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';

export function SmartBreakSuggestion() {
  const { isBreak, isActive, recommendBreakDuration, setBreakDuration } = useFocusStore();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevIsBreakRef = useRef(false);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recommendation = recommendBreakDuration();

  useEffect(() => {
    // Show when break starts
    if (isBreak && !prevIsBreakRef.current && !dismissed) {
      setShow(true);
      autoDismissTimerRef.current = setTimeout(() => {
        setShow(false);
      }, 10000);
    }
    if (!isBreak) {
      setDismissed(false);
      setShow(false);
    }
    prevIsBreakRef.current = isBreak;
    return () => {
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    };
  }, [isBreak, dismissed]);

  const handleChoose = (minutes: number) => {
    setBreakDuration(minutes * 60);
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
  };

  if (!isActive || !isBreak) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-3 shrink-0"
        >
          <div className="relative p-3 surface-soft rounded-lg border border-theme-gold/30">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 text-theme-muted hover:text-theme-primary transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="flex items-center gap-1.5 mb-2">
              <Coffee className="w-3.5 h-3.5 text-theme-gold" />
              <span className="text-xs font-medium text-theme-secondary">Break suggestion</span>
            </div>
            <p className="text-[10px] text-theme-muted mb-3 pr-4">{recommendation.reason}</p>
            <div className="flex gap-1.5">
              {[5, 10, 20].map((m) => (
                <button
                  key={m}
                  onClick={() => handleChoose(m)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    m === recommendation.minutes
                      ? 'bg-theme-gold/20 text-theme-gold border border-theme-gold/40'
                      : 'bg-theme-dim text-theme-secondary hover:text-theme-primary'
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
