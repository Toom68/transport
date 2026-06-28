import { useMemo } from 'react';
import { Plane, Sun, Moon, MapPin } from 'lucide-react';
import { useFlightStore } from '@/store/flightStore';
import { useThemeStore } from '@/store/themeStore';
import { getSolarPosition, formatTimeInTimezone } from '@/utils/time';
import { MapboxView } from './window/MapboxView';
import { DriveWindowView } from './DriveWindowView';
import { getBiome } from '@/utils/biome';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? '';

export function WindowView() {
  const { position, phase, simulationDate, departure, arrival, journeyType } = useFlightStore();
  const { mode } = useThemeStore();

  const solarData = useMemo(() => {
    if (position.lat === 0 && position.lng === 0) return null;
    return getSolarPosition(position.lat, position.lng, simulationDate);
  }, [position.lat, position.lng, simulationDate]);

  // Route to drive window view for drive mode
  if (journeyType === 'drive') {
    return <DriveWindowView />;
  }

  const isDay = solarData?.isDaytime ?? false;
  const depTime = departure ? formatTimeInTimezone(simulationDate, departure.timezone) : '--:--';
  const arrTime = arrival ? formatTimeInTimezone(simulationDate, arrival.timezone) : '--:--';
  const hasMultipleTZ = departure && arrival && departure.timezone !== arrival.timezone;
  const flightLevel = `FL${Math.round(position.altitude / 100).toString().padStart(3, '0')}`;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-theme-dim border border-theme-border select-none">
      {/* Mapbox tilted map view fills the window */}
      {MAPBOX_TOKEN ? (
        <MapboxView
          lat={position.lat}
          lng={position.lng}
          altitude={position.altitude}
          speed={position.speed}
          heading={position.heading}
          phase={phase}
          mapboxToken={MAPBOX_TOKEN}
          solarData={solarData}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-6 max-w-xs">
            <p className="text-xs text-theme-muted leading-relaxed">
              Add a Mapbox token to <code className="text-theme-secondary bg-theme-disabled-bg px-1 rounded">.env.local</code> as<br />
              <code className="text-theme-secondary bg-theme-disabled-bg px-1 rounded">VITE_MAPBOX_TOKEN=pk....</code><br />
              Get a free token at mapbox.com
            </p>
          </div>
        </div>
      )}

      {/* Cabin window frame — SVG mask creates the window opening */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <defs>
          <mask id="ovalWindow">
            <rect width="100%" height="100%" fill="white" />
            <ellipse cx="50%" cy="50%" rx="28%" ry="42%" fill="black" />
          </mask>
          <radialGradient id="wallGrad" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor={mode === 'dark' ? '#1e293b' : '#faf6ee'} />
            <stop offset="60%" stopColor={mode === 'dark' ? '#0f172a' : '#e8e0d0'} />
            <stop offset="100%" stopColor={mode === 'dark' ? '#020617' : '#c4b89e'} />
          </radialGradient>
          <radialGradient id="bezelGrad" cx="50%" cy="30%" r="80%">
            <stop offset="0%" stopColor={mode === 'dark' ? '#a89e8a' : '#ffffff'} />
            <stop offset="50%" stopColor={mode === 'dark' ? '#6b6353' : '#d4ccb8'} />
            <stop offset="100%" stopColor={mode === 'dark' ? '#3d3528' : '#a89e8a'} />
          </radialGradient>
          <linearGradient id="seatShadowTop" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor={mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)'} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
          <linearGradient id="seatShadowBottom" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor={mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)'} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
          <clipPath id="windowClip">
            <ellipse cx="50%" cy="50%" rx="27%" ry="41%" />
          </clipPath>
        </defs>

        {/* Wall fill with mask cutout */}
        <rect width="100%" height="100%" fill="url(#wallGrad)" mask="url(#ovalWindow)" />

        {/* Seat shadows — clipped to window opening */}
        <g clipPath="url(#windowClip)">
          {/* Top: seat back/headrest shadow from the seat in front */}
          <ellipse cx="50%" cy="8%" rx="35%" ry="20%" fill="url(#seatShadowTop)" />
          {/* Bottom: armrest/seat base shadow */}
          <ellipse cx="50%" cy="92%" rx="35%" ry="18%" fill="url(#seatShadowBottom)" />
        </g>

        {/* Outer bezel — thick frame ring */}
        <ellipse cx="50%" cy="50%" rx="28%" ry="42%" fill="none" stroke="url(#bezelGrad)" strokeWidth="8" />
        {/* Mid bezel — subtle highlight on top edge */}
        <ellipse cx="50%" cy="50%" rx="28%" ry="42%" fill="none" stroke={mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)'} strokeWidth="2" />
        {/* Inner edge — dark shadow for depth */}
        <ellipse cx="50%" cy="50%" rx="27%" ry="41%" fill="none" stroke={mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(61,53,40,0.15)'} strokeWidth="3" />
        {/* Inner rim — faint light catch */}
        <ellipse cx="50%" cy="50%" rx="26.5%" ry="40.5%" fill="none" stroke={mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)'} strokeWidth="1" />
      </svg>

      {/* Top-right: phase + biome + weather indicator */}
      <div className="absolute top-3 right-3 pointer-events-none z-10 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-theme-panel backdrop-blur-sm border border-theme-border">
          <Plane className="w-3 h-3 text-theme-accent" />
          <span className="text-[10px] font-medium text-theme-secondary tracking-wide uppercase">{phase}</span>
        </div>
        {MAPBOX_TOKEN && (() => {
          const biome = getBiome(position.lat, position.lng, [
            { lat: departure?.lat ?? 0, lng: departure?.lng ?? 0 },
            { lat: arrival?.lat ?? 0, lng: arrival?.lng ?? 0 },
          ]);
          return (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-theme-panel backdrop-blur-sm border border-theme-border">
              <span className="text-[10px] font-medium text-theme-secondary tracking-wide uppercase">{biome.label}</span>
            </div>
          );
        })()}
      </div>

      {/* Bottom-left: time + altitude */}
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
          <span className="text-[11px] font-mono text-theme-accent/80">{flightLevel}</span>
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
    </div>
  );
}
