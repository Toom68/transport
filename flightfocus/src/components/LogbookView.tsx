import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Plane, Route, Car, Anchor } from 'lucide-react';
import type { SaveGame, VisitedPlace } from '@/types/savegame';
import { getPlaceContinent } from '@/utils/geo';
import { formatDistance } from '@/engine/simulation';

interface LogbookViewProps {
  save: SaveGame;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function LogbookView({ save }: LogbookViewProps) {
  // Most recent first; the origin (index 0) is shown as the journey's start.
  const stops = useMemo(() => [...save.visitedPlaces].reverse(), [save.visitedPlaces]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Plane} label="Flights" value={String(save.stats.totalFlights)} />
        <Stat icon={Car} label="Drives" value={String(save.stats.totalDrives)} />
        <Stat icon={Anchor} label="Sails" value={String(save.stats.totalSails)} />
      </div>

      <div className="relative pl-4">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-theme-disabled-bg" />
        {stops.map((stop, i) => {
          const isCurrent = i === 0;
          const isOrigin = stop.id === save.originId && stop.departedFrom === save.originId && i === stops.length - 1;
          return (
            <motion.div
              key={`${stop.id}-${stop.arrivedAt}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.25) }}
              className="relative pl-4 pb-3"
            >
              <span
                className={`absolute -left-[1px] top-1.5 w-3 h-3 rounded-full border-2 ${
                  isCurrent
                    ? 'bg-theme-gold border-theme-gold'
                    : 'bg-theme-panel-solid border-theme-border-solid'
                }`}
              />
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-theme-primary">{stop.place.iata ?? stop.place.id}</span>
                    <span className="text-sm text-theme-secondary truncate">{stop.place.city}</span>
                    {isCurrent && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-theme-gold-soft text-theme-gold">You are here</span>}
                    {isOrigin && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-theme-accent-soft text-theme-accent">Start</span>}
                  </div>
                  <p className="text-[10px] text-theme-muted">
                    {getPlaceContinent(stop.place)} · {stop.place.country}
                    {stop.distanceKm > 0 && <> · {formatDistance(stop.distanceKm)} from {stop.departedFrom}</>}
                  </p>
                </div>
                <span className="text-[10px] text-theme-muted shrink-0">{formatDate(stop.arrivedAt)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="bg-theme-dim border border-theme-border rounded-lg p-2.5 text-center shadow-soft">
      <Icon className="w-3.5 h-3.5 text-theme-muted mx-auto mb-1" />
      <p className="text-sm font-mono text-theme-primary">{value}</p>
      <p className="text-[10px] text-theme-muted">{label}</p>
    </div>
  );
}
