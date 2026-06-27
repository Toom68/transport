import { motion } from 'framer-motion';
import { Plane, Car, Clock, Navigation, Gauge, Mountain, Award, Road } from 'lucide-react';
import { useFlightStore } from '@/store/flightStore';
import { useSavegameStore } from '@/store/savegameStore';
import { getPhaseDescription, formatDuration, formatDistance } from '@/engine/simulation';
import { formatTimeInTimezone } from '@/utils/time';

export function FlightInfo() {
  const { phase, position, route, progress, simulationDate, departure, arrival, journeyType } = useFlightStore();
  const activeSave = useSavegameStore((s) => s.saves.find((x) => x.id === s.activeSaveId));
  const totalMiles = activeSave?.stats.miles ?? 0;

  if (!route) return null;

  const isDrive = journeyType === 'drive';
  const JourneyIcon = isDrive ? Car : Plane;

  const etaArrivalTime = arrival
    ? formatTimeInTimezone(new Date(simulationDate.getTime() + position.timeRemaining * 1000), arrival.timezone)
    : formatDuration(position.timeRemaining);

  const stats = isDrive
    ? [
        {
          icon: Gauge,
          label: 'Speed',
          value: `${Math.round(position.speed)} km/h`,
        },
        {
          icon: Road,
          label: 'Distance Done',
          value: `${Math.round(route.distance - position.distanceRemaining)} km`,
        },
        {
          icon: Navigation,
          label: 'Heading',
          value: `${Math.round(position.heading)}°`,
        },
        {
          icon: Clock,
          label: 'ETA',
          value: etaArrivalTime,
        },
      ]
    : [
        {
          icon: Gauge,
          label: 'Speed',
          value: `${Math.round(position.speed)} kts`,
        },
        {
          icon: Mountain,
          label: 'Altitude',
          value: position.altitude > 0 ? `${Math.round(position.altitude).toLocaleString()} ft` : 'Ground',
        },
        {
          icon: Navigation,
          label: 'Heading',
          value: `${Math.round(position.heading)}°`,
        },
        {
          icon: Clock,
          label: 'ETA',
          value: etaArrivalTime,
        },
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <JourneyIcon className="w-4 h-4 text-theme-accent" />
          <span className="text-sm font-serif font-medium text-theme-primary">{getPhaseDescription(phase)}</span>
        </div>
        <span className="text-xs font-mono text-theme-muted">
          {route.departure.iata ?? route.departure.city} → {route.arrival.iata ?? route.arrival.city}
        </span>
      </div>

      <div className="relative h-1.5 bg-theme-disabled-bg rounded-full mb-4 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${progress * 100}%`, backgroundColor: 'var(--color-accent)' }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {stats.map((stat, i) => (
          <div key={stat.label} className={`flex items-center gap-2 ${i > 0 ? 'border-l border-theme-border pl-5' : ''}`}>
            <stat.icon className="w-3.5 h-3.5 text-theme-muted shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-mono text-theme-primary">{stat.value}</p>
              <p className="text-xs text-theme-muted">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-theme-border flex items-center justify-between text-xs text-theme-muted">
        <span>{formatDistance(route.distance - position.distanceRemaining)} traveled</span>
        <span>{formatDistance(position.distanceRemaining)} remaining</span>
      </div>

      {totalMiles > 0 && (
        <div className="mt-2 pt-2 border-t border-theme-border flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-theme-gold">
            <Award className="w-3 h-3" /> Travel Miles
          </span>
          <span className="font-mono text-theme-gold">{totalMiles.toLocaleString()}</span>
        </div>
      )}

      {departure && arrival && (
        <div className="mt-2 pt-2 border-t border-theme-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 text-xs">
          <span className="text-theme-muted">
            <span className="text-theme-secondary font-mono">{departure.iata ?? departure.city}</span>{' '}
            {formatTimeInTimezone(simulationDate, departure.timezone)}
          </span>
          <span className="text-theme-muted">
            <span className="text-theme-secondary font-mono">{arrival.iata ?? arrival.city}</span>{' '}
            {formatTimeInTimezone(simulationDate, arrival.timezone)}
          </span>
        </div>
      )}
    </motion.div>
  );
}
