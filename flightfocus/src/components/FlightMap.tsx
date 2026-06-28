import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useFlightStore } from '@/store/flightStore';
import { useThemeStore } from '@/store/themeStore';
import { formatDuration } from '@/engine/simulation';
import { formatTimeInTimezone } from '@/utils/time';

const planeIcon = L.divIcon({
  html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="rgba(59,130,246,0.2)"/>
    <path d="M12 4L8 12L12 10L16 12L12 4Z" fill="white" stroke="white" stroke-width="0.5"/>
    <path d="M12 10L8 18L12 16L16 18L12 10Z" fill="rgba(255,255,255,0.5)"/>
  </svg>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function makeCarIcon(heading: number): L.DivIcon {
  return L.divIcon({
    html: `<div style="transform: rotate(${heading}deg); transition: transform 0.3s ease;">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="14" r="13" fill="rgba(16,185,129,0.12)"/>
        <rect x="9" y="6" width="10" height="16" rx="3" fill="#10b981" stroke="white" stroke-width="0.8"/>
        <rect x="10.5" y="8" width="7" height="5" rx="1.5" fill="rgba(255,255,255,0.7)"/>
        <rect x="10.5" y="15" width="7" height="4" rx="1" fill="rgba(255,255,255,0.3)"/>
        <rect x="8" y="9" width="2" height="3" rx="1" fill="#1a1a1a"/>
        <rect x="18" y="9" width="2" height="3" rx="1" fill="#1a1a1a"/>
        <rect x="8" y="17" width="2" height="3" rx="1" fill="#1a1a1a"/>
        <rect x="18" y="17" width="2" height="3" rx="1" fill="#1a1a1a"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const depIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#3b82f6;border:2px solid #93c5fd;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.6);"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const arrIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#f59e0b;border:2px solid #fcd34d;border-radius:50%;box-shadow:0 0 8px rgba(245,158,11,0.6);"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      map.setView(center, zoom, { animate: false });
      initRef.current = true;
    }
  }, [map, center, zoom]);

  return null;
}

function FollowUpdater({
  follow,
  setFollow,
  position,
}: {
  follow: boolean;
  setFollow: (f: boolean) => void;
  position: [number, number];
}) {
  const map = useMap();
  const followRef = useRef(follow);
  followRef.current = follow;

  // When follow turns on, pan to plane (keep current zoom).
  useEffect(() => {
    if (follow) {
      map.panTo(position, { animate: true, duration: 1.0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, map]);

  // While following, keep plane centered on every position update.
  useEffect(() => {
    if (!follow) return;
    map.panTo(position, { animate: true, duration: 0.8 });
  }, [follow, position, map]);

  // Instantly exit follow mode on any manual map interaction.
  useEffect(() => {
    const onUserMove = () => {
      if (followRef.current) setFollow(false);
    };
    map.on('dragstart', onUserMove);
    map.on('zoomstart', onUserMove);
    return () => {
      map.off('dragstart', onUserMove);
      map.off('zoomstart', onUserMove);
    };
  }, [map, setFollow]);

  return null;
}

export function FlightMap() {
  const { route, position, progress, arrival, simulationDate, journeyType } = useFlightStore();
  const { mode } = useThemeStore();
  const isDrive = journeyType === 'drive';
  const [follow, setFollow] = useState(isDrive);

  if (!route) return null;
  const vehicleIcon = isDrive ? makeCarIcon(position.heading) : planeIcon;
  const routeColor = isDrive ? '#10b981' : '#3b82f6';
  const routeTraveledColor = isDrive ? '#10b981' : '#3b82f6';
  const routeWeight = isDrive ? 4 : 2;
  const traveledWeight = isDrive ? 5 : 3;
  const centerLat = (route.departure.lat + route.arrival.lat) / 2;
  const centerLng = (route.departure.lng + route.arrival.lng) / 2;

  const latSpan = Math.abs(route.departure.lat - route.arrival.lat);
  const lngSpan = Math.abs(route.departure.lng - route.arrival.lng);
  const maxSpan = Math.max(latSpan, lngSpan);
  const driveZoom = 13;
  const zoom = isDrive ? driveZoom : (maxSpan > 100 ? 3 : maxSpan > 50 ? 4 : maxSpan > 20 ? 5 : 6);

  // Use all route points for maximum line quality.
  const routeLatLngs: [number, number][] = route.points.map((p: { lat: number; lng: number }) => [p.lat, p.lng]);

  const traveledIndex = Math.floor(progress * (routeLatLngs.length - 1));
  const traveledLatLngs = routeLatLngs.slice(0, traveledIndex + 1);

  // Estimated arrival time at destination timezone
  const arrivalTime = arrival
    ? formatTimeInTimezone(new Date(simulationDate.getTime() + position.timeRemaining * 1000), arrival.timezone)
    : formatDuration(position.timeRemaining);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full h-full rounded-2xl overflow-hidden border border-theme-border"
    >
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={zoom}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: 'var(--map-bg)' }}
      >
        <TileLayer
          url={mode === 'dark'
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'}
        />
        <MapUpdater center={[centerLat, centerLng]} zoom={zoom} />
        <FollowUpdater follow={follow} setFollow={setFollow} position={[position.lat, position.lng]} />

        <Polyline
          positions={routeLatLngs}
          pathOptions={{
            color: routeColor,
            weight: routeWeight,
            opacity: isDrive ? 0.35 : 0.3,
            dashArray: isDrive ? '6 4' : '8 6',
          }}
        />

        {traveledLatLngs.length > 1 && (
          <Polyline
            positions={traveledLatLngs}
            pathOptions={{ color: routeTraveledColor, weight: traveledWeight, opacity: 0.9 }}
          />
        )}

        <Marker position={[route.departure.lat, route.departure.lng]} icon={depIcon} />
        <Marker position={[route.arrival.lat, route.arrival.lng]} icon={arrIcon} />
        <Marker position={[position.lat, position.lng]} icon={vehicleIcon} />
      </MapContainer>

      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
        <div className="px-2 py-1 bg-theme-panel backdrop-blur-sm rounded text-xs font-mono text-theme-accent border border-theme-border">
          {route.departure.iata ?? route.departure.city}
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-px bg-theme-accent-border" />
          <div className="w-1.5 h-1.5 rounded-full bg-theme-accent-border" />
          <div className="w-2 h-px bg-theme-accent-border" />
        </div>
        <div className="px-2 py-1 bg-theme-panel backdrop-blur-sm rounded text-xs font-mono text-theme-gold border border-theme-border">
          {route.arrival.iata ?? route.arrival.city}
        </div>
      </div>

      {/* Follow button */}
      <button
        onClick={() => setFollow((f) => !f)}
        className={`absolute top-3 right-3 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 ${
          follow
            ? 'bg-theme-accent-soft text-theme-accent border border-theme-accent-border'
            : 'bg-theme-panel backdrop-blur-sm text-theme-secondary border border-theme-border hover:text-theme-primary'
        }`}
      >
        <LocateFixed className="w-3 h-3" />
        {follow ? 'Following' : 'Follow'}
      </button>

      <div className="absolute bottom-3 left-3 right-3 z-[1000] flex items-center justify-between">
        <span className="px-2 py-1 bg-theme-panel backdrop-blur-sm rounded text-[10px] font-mono text-theme-secondary border border-theme-border">
          {(progress * 100).toFixed(1)}%
        </span>
        <span className="px-2 py-1 bg-theme-panel backdrop-blur-sm rounded text-[10px] font-mono text-theme-secondary border border-theme-border">
          ETA {arrivalTime}
        </span>
      </div>
    </motion.div>
  );
}
