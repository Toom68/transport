import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, ChevronDown } from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';

const BREATHING_PHASES = [
  { label: 'Inhale', duration: 4, color: 'text-theme-accent' },
  { label: 'Hold', duration: 4, color: 'text-theme-gold' },
  { label: 'Exhale', duration: 6, color: 'text-cyan-500' },
] as const;

export function BreathingGuide() {
  const { breathingExpanded, toggleBreathingExpanded } = useFocusStore();
  const [breathing, setBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState(0);
  const [breathCount, setBreathCount] = useState(0);

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

  return (
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
                onClick={() => {
                  setBreathing(!breathing);
                  setBreathPhase(0);
                  setBreathCount(0);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  breathing
                    ? 'bg-theme-accent-soft text-theme-accent'
                    : 'bg-theme-dim text-theme-secondary hover:text-theme-primary'
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
  );
}
