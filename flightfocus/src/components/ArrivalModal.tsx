import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PlaneLanding, Car, Loader2, Trophy, ArrowRight, BookOpen, Award, type LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useFlightStore } from '@/store/flightStore';
import { useSavegameStore } from '@/store/savegameStore';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';
import { CitySketch } from './CitySketch';
import { formatDistance, formatDuration } from '@/engine/simulation';

function iconByName(name: string): LucideIcon {
  const map = Icons as unknown as Record<string, LucideIcon>;
  return map[name] ?? Trophy;
}

export function ArrivalModal() {
  const {
    departure, arrival, route, sessionRealSeconds, cruiseRealSeconds, departedLocalHour,
    arrivalProcessed, markArrivalProcessed, setDeparture, returnToGrounded, journeyType,
  } = useFlightStore();
  const { recordArrival, fillJournalEntry } = useSavegameStore();

  const activeSave = useSavegameStore((s) => s.saves.find((x) => x.id === s.activeSaveId));

  const [journalId, setJournalId] = useState<string | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || arrivalProcessed) return;
    if (!departure || !arrival) return;
    ranRef.current = true;

    const res = recordArrival({
      from: departure,
      to: arrival,
      journeyType,
      ambientMinutes: sessionRealSeconds / 60,
      cruiseMinutes: cruiseRealSeconds / 60,
      departedLocalHour: departedLocalHour ?? undefined,
      distanceKm: route?.distance,
    });
    markArrivalProcessed();

    if (res) {
      setJournalId(res.journalId);
      setNewlyUnlocked(res.newlyUnlocked);
      void fillJournalEntry(res.journalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const journalEntry = journalId
    ? activeSave?.journalEntries.find((j) => j.id === journalId)
    : undefined;

  const handleContinue = () => {
    if (arrival) setDeparture(arrival);
    returnToGrounded();
  };

  if (!arrival) return null;

  const isDrive = journeyType === 'drive';
  const ArrivalIcon = isDrive ? Car : PlaneLanding;
  const headerBg = isDrive
    ? 'bg-theme-gold-soft'
    : 'bg-theme-accent-soft';
  const ambientMin = Math.round(sessionRealSeconds / 60);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[5000] bg-theme-overlay backdrop-blur-md flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 22 }}
        className="w-full max-w-lg bg-theme-panel-solid border border-theme-border rounded-2xl overflow-hidden max-h-[92vh] flex flex-col shadow-panel"
      >
        {/* Header */}
        <div className={`p-6 ${headerBg} text-center`}>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-theme-panel-solid mb-3">
            <ArrivalIcon className="w-6 h-6 text-theme-accent" />
          </div>
          <p className="text-xs uppercase tracking-wider text-theme-secondary">{isDrive ? "You've driven to" : "You've arrived in"}</p>
          <h2 className="text-3xl font-serif font-bold text-theme-primary mt-1">{arrival.city}</h2>
          <p className="text-sm text-theme-secondary mt-1">{arrival.name}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 text-xs text-theme-muted">
            <span>{departure?.iata ?? departure?.city} → {arrival.iata ?? arrival.city}</span>
            {route && <span>{formatDistance(route.distance)}</span>}
            <span>{ambientMin >= 1 ? formatDuration(sessionRealSeconds) : '<1m'} traveling</span>
          </div>
          {activeSave && activeSave.stats.miles > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-xs">
              <Award className="w-3.5 h-3.5 text-theme-gold" />
              <span className="text-theme-gold font-mono">{activeSave.stats.miles.toLocaleString()}</span>
              <span className="text-theme-muted">total miles</span>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 overflow-y-auto space-y-4">
          {/* Achievements */}
          {newlyUnlocked.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-wider text-theme-gold flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Achievement{newlyUnlocked.length > 1 ? 's' : ''} unlocked
              </p>
              {newlyUnlocked.map((id, i) => {
                const a = ACHIEVEMENTS_BY_ID[id];
                if (!a) return null;
                const Icon = iconByName(a.icon);
                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.12 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-theme-gold-soft border border-theme-gold-border"
                  >
                    <div className="w-9 h-9 rounded-lg bg-theme-gold-soft text-theme-gold flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-theme-primary">{a.name}</p>
                      <p className="text-xs text-theme-secondary">{a.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Journal entry about the city left behind */}
          <div className="surface-soft rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-theme-muted flex items-center gap-1 mb-2">
              <BookOpen className="w-3 h-3" /> A page from {departure?.city}
            </p>
            <div className="flex gap-3">
              <div className="shrink-0 w-24 h-16 rounded-lg bg-theme-panel-solid border border-theme-border flex items-center justify-center text-theme-accent">
                {journalEntry && <CitySketch sketchKey={journalEntry.svgKey} className="w-20 h-14" />}
              </div>
              <div className="flex-1 min-w-0">
                {!journalEntry || journalEntry.isGenerating ? (
                  <div className="flex items-center gap-2 text-sm text-theme-muted py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Writing your journal…
                  </div>
                ) : (
                  <p className="text-sm text-theme-secondary italic leading-relaxed font-serif">{journalEntry.text}</p>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleContinue}
            className="w-full py-3.5 btn-primary rounded-xl flex items-center justify-center gap-2"
          >
            Continue in {arrival.city}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
