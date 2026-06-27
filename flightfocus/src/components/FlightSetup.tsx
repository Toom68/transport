import { motion } from 'framer-motion';
import { Plane, Car, Anchor, ArrowRight, Clock, MapPin, Sun, Moon } from 'lucide-react';
import { useFlightStore } from '@/store/flightStore';
import { PlaceSearch } from './PlaceSearch';
import { greatCircleDistance, estimateDuration, initialBearing } from '@/engine/navigation';
import { formatDuration, formatDistance } from '@/engine/simulation';
import { getAvailableJourneyTypes } from '@/data/places';
import type { JourneyType } from '@/types/place';

export function FlightSetup() {
  const { departure, arrival, setDeparture, setArrival, setJourneyType, journeyType, startFlight, timeMode, setTimeMode, customHour, setCustomHour } = useFlightStore();

  const distance = departure && arrival
    ? greatCircleDistance(departure.lat, departure.lng, arrival.lat, arrival.lng)
    : 0;

  const duration = distance > 0 ? estimateDuration(distance, journeyType) : 0;
  const availableJourneyTypes = departure && arrival ? getAvailableJourneyTypes(departure, arrival) : [];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-theme-accent-soft border border-theme-accent-border mb-4"
          >
            <Plane className="w-8 h-8 text-theme-accent" />
          </motion.div>
          <h1 className="text-3xl font-serif font-bold text-theme-primary mb-2">transportfocus</h1>
          <p className="text-theme-secondary text-sm">Select your route. Begin your focus journey.</p>
        </div>

        <div className="surface rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlaceSearch
              label="Departure"
              value={departure}
              onChange={setDeparture}
              placeholder="Search departure place..."
            />
            <PlaceSearch
              label="Arrival"
              value={arrival}
              onChange={setArrival}
              placeholder="Search arrival place..."
            />
          </div>

          {departure && arrival && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="border-t border-theme-border pt-4"
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-theme-primary">{departure.iata ?? departure.city}</span>
                  <ArrowRight className="w-4 h-4 text-theme-muted" />
                  <span className="font-mono font-bold text-theme-primary">{arrival.iata ?? arrival.city}</span>
                </div>

                {/* Transport journey type selector */}
                <div className="flex gap-2 mt-3">
                  {availableJourneyTypes.map((m) => {
                    const Icon = m === 'fly' ? Plane : m === 'drive' ? Car : Anchor;
                    const label = m === 'fly' ? 'Fly' : m === 'drive' ? 'Drive' : 'Sail';
                    return (
                      <button
                        key={m}
                        onClick={() => setJourneyType(m as JourneyType)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                          journeyType === m
                            ? 'bg-theme-accent-soft text-theme-accent border border-theme-accent-border'
                            : 'bg-theme-dim text-theme-muted border border-theme-border hover:text-theme-secondary'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-2 text-theme-secondary">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{formatDistance(distance)}</span>
                </div>
                <div className="flex items-center gap-2 text-theme-secondary">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{formatDuration(duration)}</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-theme-dim rounded-lg border border-theme-border">
                <div className="flex items-center justify-between text-xs text-theme-muted">
                  <span>Bearing: {Math.round(initialBearing(departure.lat, departure.lng, arrival.lat, arrival.lng))}°</span>
                  <span>Route: Great Circle</span>
                  <span>Type: {journeyType}</span>
                </div>
              </div>

              <div className="mt-4 p-4 bg-theme-dim rounded-lg border border-theme-border space-y-3">
                <div className="flex items-center gap-2 text-sm text-theme-secondary">
                  {customHour >= 6 && customHour < 18 ? (
                    <Sun className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Moon className="w-4 h-4 text-theme-muted" />
                  )}
                  <span className="font-medium">Departure Time</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setTimeMode('realtime')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono transition-all duration-200 ${
                      timeMode === 'realtime'
                        ? 'bg-theme-accent-soft text-theme-accent border border-theme-accent-border'
                        : 'bg-theme-dim text-theme-muted border border-theme-border hover:text-theme-secondary'
                    }`}
                  >
                    Real Time
                  </button>
                  <button
                    onClick={() => setTimeMode('custom')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono transition-all duration-200 ${
                      timeMode === 'custom'
                        ? 'bg-theme-accent-soft text-theme-accent border border-theme-accent-border'
                        : 'bg-theme-dim text-theme-muted border border-theme-border hover:text-theme-secondary'
                    }`}
                  >
                    Custom Time
                  </button>
                </div>

                {timeMode === 'realtime' ? (
                  <p className="text-[11px] text-theme-muted">
                    Uses your device clock. Sky will match real local time at departure and adjust as you fly across time zones.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-theme-secondary">
                        Local time at {departure.iata ?? departure.city}
                      </span>
                      <span className="text-sm font-mono text-theme-primary">
                        {String(customHour).padStart(2, '0')}:00
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={23}
                      value={customHour}
                      onChange={(e) => setCustomHour(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-theme-disabled-bg accent-theme-accent cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-theme-muted font-mono">
                      <span>00:00</span>
                      <span>06:00</span>
                      <span>12:00</span>
                      <span>18:00</span>
                      <span>23:00</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={!departure || !arrival}
            onClick={startFlight}
            className="w-full py-4 btn-primary rounded-xl disabled:bg-theme-disabled-bg disabled:text-theme-muted flex items-center justify-center gap-2"
          >
            <Plane className="w-5 h-5" />
            Begin Journey
          </motion.button>
        </div>

        <p className="text-center text-xs text-theme-muted mt-6">
          Simulation uses real great-circle routes and transport-specific calculations
        </p>
      </motion.div>
    </div>
  );
}
