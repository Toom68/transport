import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, RotateCcw, Play, X, Sun, Moon } from 'lucide-react';
import { useFlightStore, hasPersistedFlight, getPersistedFlightInfo } from '@/store/flightStore';
import { useThemeStore } from '@/store/themeStore';
import { HomeScreen } from '@/components/HomeScreen';
import { GroundedView } from '@/components/GroundedView';
import { SimulationView } from '@/components/SimulationView';
import { SpotifyCallback } from '@/components/SpotifyCallback';

function ResumeDialog({ onContinue, onRestart }: { onContinue: () => void; onRestart: () => void }) {
  const info = getPersistedFlightInfo();
  if (!info) return null;

  const phaseLabel = info.phase.charAt(0) + info.phase.slice(1).toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-theme-panel-solid border border-theme-border rounded-2xl p-6 shadow-panel"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-theme-accent-soft flex items-center justify-center">
            <Plane className="w-5 h-5 text-theme-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-theme-primary">Resume flight?</h2>
            <p className="text-xs text-theme-secondary">{info.fromCity} → {info.toCity}</p>
          </div>
        </div>

        <p className="text-xs text-theme-secondary mb-5">
          You have a flight in progress ({phaseLabel} phase). Continue where you left off, or start fresh from your current airport.
        </p>

        <div className="space-y-2">
          <button
            onClick={onContinue}
            className="w-full py-3 bg-gradient-to-r from-sky-400 to-sky-500 hover:shadow-glow text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Continue flight
          </button>
          <button
            onClick={onRestart}
            className="w-full py-3 bg-theme-dim hover:bg-theme-disabled-bg text-theme-secondary font-medium rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Start from airport
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const { viewMode, restorePersistedFlight, discardPersistedFlight, setViewMode, departure } = useFlightStore();
  const { mode, toggle } = useThemeStore();
  const [showResume, setShowResume] = useState(false);

  useEffect(() => {
    if (hasPersistedFlight() && viewMode === 'home') {
      setShowResume(true);
    }
  }, []);

  const handleContinue = () => {
    restorePersistedFlight();
    setShowResume(false);
  };

  const handleRestart = () => {
    discardPersistedFlight();
    setShowResume(false);
    // If we have a departure airport, go to grounded view at that airport
    if (departure) {
      setViewMode('grounded');
    }
  };

  // Spotify OAuth callback route.
  if (window.location.pathname === '/spotify-callback') {
    return <SpotifyCallback />;
  }

  return (
    <div className="min-h-screen bg-cabin-dark font-display">
      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="fixed top-4 right-4 z-[60] w-10 h-10 rounded-full glass-panel flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        aria-label="Toggle theme"
      >
        {mode === 'dark' ? (
          <Sun className="w-4 h-4 text-theme-gold" />
        ) : (
          <Moon className="w-4 h-4 text-theme-accent" />
        )}
      </button>

      {viewMode === 'home' && <HomeScreen />}
      {viewMode === 'grounded' && <GroundedView />}
      {(viewMode === 'simulation' || viewMode === 'fullscreen') && <SimulationView />}

      <AnimatePresence>
        {showResume && (
          <ResumeDialog onContinue={handleContinue} onRestart={handleRestart} />
        )}
      </AnimatePresence>
    </div>
  );
}
