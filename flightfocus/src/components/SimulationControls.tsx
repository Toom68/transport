import { motion } from 'framer-motion';
import { Pause, Play, Square, Gauge } from 'lucide-react';
import { useFlightStore } from '@/store/flightStore';

export function SimulationControls() {
  const { isPaused, timeScale, phase, pauseFlight, resumeFlight, stopFlight, setTimeScale } = useFlightStore();

  const speeds = [1, 10, 30, 60, 120, 300];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-theme-muted" />
          <span className="text-sm font-medium text-theme-primary">Simulation</span>
        </div>
        <span className="text-xs font-mono text-theme-accent">{timeScale}x</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        {phase !== 'ARRIVED' ? (
          <>
            <button
              onClick={isPaused ? resumeFlight : pauseFlight}
              className="flex-1 py-2 bg-theme-accent-soft text-theme-accent text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1"
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={stopFlight}
              className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium rounded-lg transition-colors"
            >
              <Square className="w-3 h-3" />
            </button>
          </>
        ) : (
          <button
            onClick={stopFlight}
            className="flex-1 py-2 bg-theme-gold-soft hover:bg-theme-gold-medium text-theme-gold text-xs font-medium rounded-lg transition-all duration-200"
          >
            New Flight
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {speeds.map((speed) => (
          <button
            key={speed}
            onClick={() => setTimeScale(speed)}
            className={`py-1.5 px-3 text-xs font-mono rounded-full transition-colors ${
              timeScale === speed
                ? 'bg-theme-accent text-white'
                : 'bg-theme-dim text-theme-muted hover:bg-theme-hover'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </motion.div>
  );
}
