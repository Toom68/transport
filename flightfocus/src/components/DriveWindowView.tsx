import { useMemo, useState } from 'react';
import { Car, Sun, Moon, MapPin, Camera, Eye } from 'lucide-react';
import { useFlightStore } from '@/store/flightStore';
import { useThemeStore } from '@/store/themeStore';
import { getSolarPosition, formatTimeInTimezone } from '@/utils/time';
import { MapboxView } from './window/MapboxView';
import { DriveScene } from './window/DriveScene';
import { WindshieldFrame } from './window/WindshieldFrame';
import { ChaseCamView } from './window/ChaseCamView';
import { StreetView } from './window/StreetView';
import { getBiome } from '@/utils/biome';
import type { JourneyPhase } from '@/types/journey';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? '';
const MAPILLARY_TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN ?? '';
const GOOGLE_STREETVIEW_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

type ViewMode = 'windshield' | 'chase' | 'passenger';

const DRIVE_PHASE_LABELS: Record<JourneyPhase, string> = {
  BOARDING: 'Boarding',
  TAXI: 'Taxiing',
  TAKEOFF: 'Takeoff',
  CLIMB: 'Climbing',
  CRUISE: 'Cruising',
  DESCENT: 'Descending',
  APPROACH: 'Approaching',
  LANDING: 'Landing',
  DEPARTING: 'Setting Off',
  DRIVING: 'On the Road',
  ARRIVING: 'Approaching',
  SAILING: 'Sailing',
  DOCKING: 'Docking',
  ARRIVED: 'Arrived',
};

export function DriveWindowView() {
  const { position, phase, simulationDate, departure, arrival, isRouteLoading, progress, route } = useFlightStore();
  const { mode } = useThemeStore();
  const [viewMode, setViewMode] = useState<ViewMode>('windshield');
  const isMoving = phase === 'DRIVING' || phase === 'DEPARTING' || phase === 'ARRIVING';

  const solarData = useMemo(() => {
    if (position.lat === 0 && position.lng === 0) return null;
    return getSolarPosition(position.lat, position.lng, simulationDate);
  }, [position.lat, position.lng, simulationDate]);

  const isDay = solarData?.isDaytime ?? false;
  const depTime = departure ? formatTimeInTimezone(simulationDate, departure.timezone) : '--:--';
  const arrTime = arrival ? formatTimeInTimezone(simulationDate, arrival.timezone) : '--:--';
  const hasMultipleTZ = departure && arrival && departure.timezone !== arrival.timezone;
  const speedKmh = Math.round(position.speed);
  const speedColor = speedKmh > 100 ? 'text-amber-500' : speedKmh > 60 ? 'text-emerald-500' : 'text-theme-accent/80';

  const biome = getBiome(position.lat, position.lng, [
    { lat: departure?.lat ?? 0, lng: departure?.lng ?? 0 },
    { lat: arrival?.lat ?? 0, lng: arrival?.lng ?? 0 },
  ]);

  if (isRouteLoading) {
    return (
      <div className="relative w-full h-full rounded-2xl overflow-hidden bg-theme-dim border border-theme-border select-none flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-theme-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-theme-muted">
            Calculating route{arrival ? ` to ${arrival.city ?? arrival.name}` : ''}…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-theme-dim border border-theme-border select-none">
      {viewMode === 'passenger' && (MAPILLARY_TOKEN || GOOGLE_STREETVIEW_KEY) ? (
        <StreetView
          lat={position.lat}
          lng={position.lng}
          heading={position.heading}
          accessToken={MAPILLARY_TOKEN}
          googleApiKey={GOOGLE_STREETVIEW_KEY || undefined}
          isMoving={isMoving}
          routePoints={route?.points ?? []}
        />
      ) : viewMode === 'chase' ? (
        <ChaseCamView
          speed={position.speed}
          heading={position.heading}
          solarData={solarData}
          phase={phase}
        />
      ) : MAPBOX_TOKEN ? (
        <MapboxView
          lat={position.lat}
          lng={position.lng}
          altitude={0}
          speed={position.speed}
          heading={position.heading}
          phase={phase}
          mapboxToken={MAPBOX_TOKEN}
          solarData={solarData}
          driveMode
        />
      ) : (
        <DriveScene
          speed={position.speed}
          progress={position.progress}
          phase={phase}
          solarData={solarData}
        />
      )}

      {/* Window frame overlay */}
      <WindshieldFrame mode={mode} />

      {/* Top-right: phase + biome indicator */}
      <div className="absolute top-3 right-3 pointer-events-none z-10 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-theme-panel backdrop-blur-sm border border-theme-border">
          <Car className="w-3 h-3 text-theme-accent" />
          <span className="text-[10px] font-medium text-theme-secondary tracking-wide uppercase">{DRIVE_PHASE_LABELS[phase]}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-theme-panel backdrop-blur-sm border border-theme-border">
          <span className="text-[10px] font-medium text-theme-secondary tracking-wide uppercase">{biome.label}</span>
        </div>
      </div>

      {/* View mode toggle — cycle through available views */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1">
        {(['windshield', 'chase', ...((MAPILLARY_TOKEN || GOOGLE_STREETVIEW_KEY) ? ['passenger'] : [])] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 ${
              viewMode === mode
                ? 'bg-theme-accent-soft text-theme-accent border border-theme-accent-border'
                : 'bg-theme-panel backdrop-blur-sm text-theme-secondary border border-theme-border hover:text-theme-primary'
            }`}
          >
            {mode === 'windshield' && <Camera className="w-3 h-3" />}
            {mode === 'chase' && <Car className="w-3 h-3" />}
            {mode === 'passenger' && <Eye className="w-3 h-3" />}
            {mode === 'windshield' ? 'Windshield' : mode === 'chase' ? 'Chase Cam' : 'Passenger'}
          </button>
        ))}
      </div>

      {/* Bottom-left: time + speed */}
      <div className="absolute bottom-3 left-3 pointer-events-none z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-theme-panel backdrop-blur-sm border border-theme-border">
          <div className="flex items-center gap-1.5">
            {isDay ? (
              <Sun className="w-3 h-3 text-amber-500/80" />
            ) : (
              <Moon className="w-3 h-3 text-theme-muted" />
            )}
            <span className="text-[11px] font-mono text-theme-secondary">{depTime}</span>
            {hasMultipleTZ && (
              <>
                <span className="text-[10px] text-theme-muted">→</span>
                <span className="text-[11px] font-mono text-theme-secondary">{arrTime}</span>
              </>
            )}
          </div>
          <div className="w-px h-3 bg-theme-disabled-bg" />
          <span className={`text-[11px] font-mono ${speedColor}`}>{speedKmh} km/h</span>
        </div>
      </div>

      {/* Bottom-right: coordinates */}
      <div className="absolute bottom-3 right-3 pointer-events-none z-10">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-theme-panel backdrop-blur-sm border border-theme-border">
          <MapPin className="w-3 h-3 text-theme-muted" />
          <span className="text-[10px] font-mono text-theme-secondary">
            {position.lat.toFixed(1)}°, {position.lng.toFixed(1)}°
          </span>
        </div>
      </div>

      {/* Progress bar along the bottom of the windshield */}
      <div className="absolute bottom-0 left-0 right-0 h-1 z-10 pointer-events-none">
        <div className="h-full bg-theme-disabled-bg/50">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
