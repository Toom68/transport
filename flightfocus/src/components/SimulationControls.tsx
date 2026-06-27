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
      className="bg-theme-panel backdrop-blur-xl border border-theme-border rounded-xl p-4 shadow-panel"
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
              className="flex-1 py-2 bg-theme-accent-medium hover:bg-theme-hover text-theme-accent text-xs font-medium rounded-lg transition-all duration-200 hover:shadow-glow flex items-center justify-center gap-1"
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={stopFlight}
              className="py-2 px-3 bg-red-500/15 hover:bg-red-500/25 text-red-500 text-xs font-medium rounded-lg transition-colors"
            >
              <Square className="w-3 h-3" />
            </button>
          </>
        ) : (
          <button
            onClick={stopFlight}
            className="flex-1 py-2 bg-theme-gold-medium hover:bg-theme-hover text-theme-gold text-xs font-medium rounded-lg transition-all duration-200 hover:shadow-glow-gold"
          >
            New Flight
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
        {speeds.map((speed) => (
          <button
            key={speed}
            onClick={() => setTimeScale(speed)}
            className={`py-1.5 text-[10px] font-mono rounded transition-colors ${
              timeScale === speed
                ? 'bg-theme-accent text-white'
                : 'bg-theme-dim text-theme-muted hover:bg-theme-disabled-bg'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </motion.div>
  );
}
