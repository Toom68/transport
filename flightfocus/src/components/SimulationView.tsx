import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Wand2, Music2, BookOpen } from 'lucide-react';
import { useFlightStore } from '@/store/flightStore';
import { useFocusStore } from '@/store/focusStore';
import { WindowView } from './WindowView';
import { FlightMap } from './FlightMap';
import { FlightInfo } from './FlightInfo';
import { AudioMixer } from './AudioMixer';
import { MusicPlayer } from './MusicPlayer';
import { FocusTimer } from './FocusTimer';
import { SimulationControls } from './SimulationControls';
import { JournalPanel } from './JournalPanel';
import { ArrivalModal } from './ArrivalModal';
import { GuestControlNotice } from './GuestControlNotice';
import { useMultiplayerStore } from '@/store/multiplayerStore';

type SidebarTab = 'focus' | 'audio' | 'music' | 'journal';

const TABS: { id: SidebarTab; label: string; icon: typeof Timer }[] = [
  { id: 'focus', label: 'Focus', icon: Timer },
  { id: 'audio', label: 'Sound', icon: Wand2 },
  { id: 'music', label: 'Music', icon: Music2 },
  { id: 'journal', label: 'Journal', icon: BookOpen },
];

export function SimulationView() {
  const { tick, isActive, isPaused, phase, multiplayerMode, applyRemoteState } = useFlightStore();
  const { isMinimalUI } = useFocusStore();
  const { lastRemoteState } = useMultiplayerStore();
  const lastTimeRef = useRef<number>(performance.now());
  const frameRef = useRef<number>(0);
  const [activeTab, setActiveTab] = useState<SidebarTab>('focus');

  useEffect(() => {
    if (!isActive || isPaused) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    // rAF loop — used while the tab is visible for smooth, high-FPS updates.
    const loop = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      if (delta < 1) {
        tick(delta);
      }
      frameRef.current = requestAnimationFrame(loop);
    };

    // Interval loop — used while the tab is hidden so the sim keeps running.
    // Browsers throttle background intervals to ~1s minimum, which is fine.
    const intervalTick = () => {
      const now = performance.now();
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      if (delta > 0 && delta < 10) {
        tick(delta);
      }
    };

    const startRaf = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      lastTimeRef.current = performance.now();
      frameRef.current = requestAnimationFrame(loop);
    };

    const startInterval = () => {
      cancelAnimationFrame(frameRef.current);
      lastTimeRef.current = performance.now();
      intervalId = setInterval(intervalTick, 250);
    };

    const onVisibilityChange = () => {
      if (document.hidden) startInterval();
      else startRaf();
    };

    if (document.hidden) startInterval();
    else startRaf();

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelAnimationFrame(frameRef.current);
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isActive, isPaused, tick]);

  // Guest: apply remote state whenever it updates
  useEffect(() => {
    if (multiplayerMode === 'guest' && lastRemoteState) {
      applyRemoteState(lastRemoteState);
    }
  }, [multiplayerMode, lastRemoteState, applyRemoteState]);

  return (
    <div className="min-h-[100dvh] lg:h-screen flex flex-col lg:flex-row lg:overflow-hidden">
      <div className="flex flex-col p-4 gap-4 min-w-0 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:flex-1 lg:min-h-0">
          <div className="h-[30vh] sm:h-[42vh] lg:h-auto lg:min-h-0">
            <WindowView />
          </div>
          <div className="h-[30vh] sm:h-[42vh] lg:h-auto lg:min-h-0">
            <FlightMap />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <FlightInfo />
        </motion.div>
      </div>

      {!isMinimalUI && (
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full lg:w-80 p-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-theme-border lg:overflow-hidden"
        >
          {multiplayerMode === 'guest' ? <GuestControlNotice /> : <SimulationControls />}

          {/* Tab bar */}
          <div className="flex gap-4 border-b border-theme-border shrink-0">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                    active ? 'border-theme-accent text-theme-primary' : 'border-transparent text-theme-secondary hover:text-theme-primary'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Active panel — fills remaining sidebar height on desktop, natural height on mobile */}
          <div className="lg:flex-1 lg:min-h-0 flex flex-col">
            {activeTab === 'focus' && <FocusTimer />}
            {activeTab === 'journal' && <JournalPanel />}
            {/* Audio + Music stay mounted but hidden to keep audio playing */}
            <div className={`lg:flex-1 lg:min-h-0 flex flex-col ${activeTab === 'audio' ? '' : 'hidden'}`}>
              <AudioMixer />
            </div>
            <div className={`lg:flex-1 lg:min-h-0 flex flex-col ${activeTab === 'music' ? '' : 'hidden'}`}>
              <MusicPlayer />
            </div>
          </div>
        </motion.aside>
      )}

      <AnimatePresence>
        {phase === 'ARRIVED' && <ArrivalModal />}
      </AnimatePresence>
    </div>
  );
}
