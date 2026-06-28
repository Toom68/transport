import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Car, BookOpen, Trophy, Route, ChevronLeft, Navigation, Award } from 'lucide-react';
import { useSavegameStore } from '@/store/savegameStore';
import { useFlightStore } from '@/store/flightStore';
import type { Place, JourneyType } from '@/types/place';
import { getPlaceContinent } from '@/utils/geo';
import { getSketchKey } from '@/data/citySketchData';
import { CitySketch } from './CitySketch';
import { JournalView } from './JournalView';
import { LogbookView } from './LogbookView';
import { AchievementsPanel } from './AchievementsPanel';
import { AudioMixer } from './AudioMixer';
import { WorldMapPicker } from './WorldMapPicker';

type Tab = 'journal' | 'logbook' | 'achievements';

export function GroundedView() {
  const { getActiveSave, exitToHome } = useSavegameStore();
  const { setDeparture, setArrival, setJourneyType, startFlight, setViewMode, journeyType } = useFlightStore();
  const [tab, setTab] = useState<Tab>('logbook');
  const [pickerOpen, setPickerOpen] = useState(false);

  const save = getActiveSave();

  const isDrive = journeyType === 'drive';
  const JourneyIcon = isDrive ? Car : Plane;

  if (!save) {
    // No active save — bounce back home.
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button onClick={() => setViewMode('home')} className="text-theme-accent text-sm">Return to menu</button>
      </div>
    );
  }

  const here = save.currentPlace;

  const handleExit = () => {
    exitToHome();
    setViewMode('home');
  };

  const handleSelectDestination = (dest: Place, journeyType: JourneyType, customDeparture?: Place) => {
    const departure = customDeparture ?? here;
    setDeparture(departure);
    setArrival(dest);
    setJourneyType(journeyType);
    setPickerOpen(false);
    startFlight();
  };

  const tabs: { id: Tab; label: string; icon: typeof Plane }[] = [
    { id: 'logbook', label: 'Logbook', icon: Route },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
  ];

  return (
    <div className="min-h-screen p-5 sm:p-7">
      <div className="max-w-5xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleExit} className="flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Journeys
          </button>
          <span className="text-sm text-theme-secondary truncate max-w-[60%]">{save.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: hero + tabs */}
          <div className="lg:col-span-2 space-y-5">
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface rounded-2xl p-6"
            >
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="shrink-0 w-full sm:w-36 h-28 rounded-xl bg-theme-dim border border-theme-border flex items-center justify-center text-theme-accent/80">
                  <CitySketch sketchKey={getSketchKey(here.id)} className="w-32 h-24" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wider text-theme-secondary">You are in</p>
                  <h1 className="text-3xl font-serif font-semibold text-theme-primary truncate mt-0.5">{here.city}</h1>
                  <p className="text-sm text-theme-secondary truncate mt-1">{here.name}</p>
                  <p className="text-xs text-theme-muted mt-1.5">
                    <span className="font-mono">{here.iata ?? here.id}</span> · {getPlaceContinent(here)} · {here.country}
                  </p>
                  {save.stats.miles > 0 && (
                    <p className="text-xs mt-2 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-theme-gold" />
                      <span className="font-mono text-theme-gold">{save.stats.miles.toLocaleString()}</span>
                      <span className="text-theme-secondary">travel miles</span>
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setPickerOpen(true)}
                className="w-full mt-5 py-3.5 btn-primary rounded-lg flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                Choose your next destination
              </button>
            </motion.div>

            {/* Tabs */}
            <div className="surface rounded-2xl p-5">
              <div className="flex gap-5 mb-4 border-b border-theme-border">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      tab === t.id ? 'border-theme-accent text-theme-primary' : 'border-transparent text-theme-secondary hover:text-theme-primary'
                    }`}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="max-h-[46vh] overflow-y-auto pr-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    {tab === 'journal' && <JournalView entries={save.journalEntries} />}
                    {tab === 'logbook' && <LogbookView save={save} />}
                    {tab === 'achievements' && (
                      <AchievementsPanel unlocked={save.unlockedAchievements} unlockedAt={save.achievementUnlockedAt} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right: ambient audio */}
          <div className="space-y-5">
            <AudioMixer />
            <p className="text-xs text-theme-muted px-1 font-serif italic">
              {isDrive
                ? 'The engine rests in cool silence. Set your soundscape, then choose where the road takes you.'
                : 'The terminal hums quietly around you. Set your soundscape, then choose where the day takes you.'}
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {pickerOpen && (
          <WorldMapPicker from={here} onSelect={handleSelectDestination} onClose={() => setPickerOpen(false)} allowStartSelection />
        )}
      </AnimatePresence>
    </div>
  );
}
