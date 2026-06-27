import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Search, Plane, Car, Anchor, MapPin, Clock, ArrowRight } from 'lucide-react';
import type { Place, TransportMode } from '@/types/place';
import { places } from '@/data/places';
import { getAvailableModes, getDefaultMode } from '@/data/places';
import {
  greatCircleDistance, estimateDuration, initialBearing, generateRoutePoints,
} from '@/engine/navigation';
import { formatDuration, formatDistance } from '@/engine/simulation';
import { searchPlaces } from '@/utils/search';
import { useThemeStore } from '@/store/themeStore';

interface WorldMapPickerProps {
  from: Place;
  onSelect: (place: Place, mode: TransportMode) => void;
  onClose: () => void;
}

const dotIcon = L.divIcon({
  html: `<div style="width:8px;height:8px;background:#64748b;border:1.5px solid #94a3b8;border-radius:50%;"></div>`,
  className: 'ff-dot',
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

const regionalIcon = L.divIcon({
  html: `<div style="width:5px;height:5px;background:#475569;border:1px solid #64748b;border-radius:50%;opacity:0.7;"></div>`,
  className: 'ff-reg',
  iconSize: [5, 5],
  iconAnchor: [2.5, 2.5],
});

const fromIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;background:#f59e0b;border:2px solid #fcd34d;border-radius:50%;box-shadow:0 0 10px rgba(245,158,11,0.7);"></div>`,
  className: 'ff-from',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const selectedIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;background:#3b82f6;border:2px solid #93c5fd;border-radius:50%;box-shadow:0 0 12px rgba(59,130,246,0.8);"></div>`,
  className: 'ff-sel',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FlyTo({ target }: { target: Place | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 3), { duration: 0.8 });
  }, [target, map]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Leaflet often mis-measures the container when mounted inside an
    // animated / flex modal.  Force it to recompute after the animation
    // has had time to settle.
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 350);
    const t3 = setTimeout(() => map.invalidateSize(), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [map]);
  return null;
}

export function WorldMapPicker({ from, onSelect, onClose }: WorldMapPickerProps) {
  const { mode } = useThemeStore();
  const [selected, setSelected] = useState<Place | null>(null);
  const [query, setQuery] = useState('');

  const searchResults = useMemo(
    () => (query.length > 0 ? searchPlaces(query, 6) : []),
    [query]
  );

  const distance = selected
    ? greatCircleDistance(from.lat, from.lng, selected.lat, selected.lng)
    : 0;
  const availableModes = selected ? getAvailableModes(from, selected) : [];
  const defaultMode = selected ? getDefaultMode(from, selected) : 'fly';
  const [selectedMode, setSelectedMode] = useState<TransportMode>('fly');

  // When a new place is selected, reset mode to default
  useEffect(() => {
    if (selected) setSelectedMode(defaultMode);
  }, [selected, defaultMode]);

  const duration = distance > 0 ? estimateDuration(distance, selectedMode) : 0;
  const bearing = selected ? initialBearing(from.lat, from.lng, selected.lat, selected.lng) : 0;

  const routeLatLngs: [number, number][] = useMemo(() => {
    if (!selected) return [];
    return generateRoutePoints(from.lat, from.lng, selected.lat, selected.lng, 64).map(
      (p) => [p.lat, p.lng] as [number, number]
    );
  }, [from, selected]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-theme-overlay backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-theme-panel-solid border border-theme-border rounded-2xl overflow-hidden flex flex-col max-h-[92vh] shadow-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-border">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-theme-accent" />
            <span className="text-sm font-medium text-theme-primary">Choose your destination</span>
            <span className="text-xs text-theme-muted">from {from.city} ({from.iata ?? from.id})</span>
          </div>
          <button onClick={onClose} className="text-theme-muted hover:text-theme-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-theme-border relative z-[1100]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a city, airport, or port..."
              className="w-full pl-10 pr-4 py-2.5 bg-theme-dim border border-theme-border rounded-lg text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border text-sm"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="absolute left-3 right-3 mt-1 z-[1200] bg-theme-panel-solid border border-theme-border rounded-lg shadow-panel overflow-hidden">
              {searchResults.map((r) => (
                <button
                  key={r.place.id}
                  onClick={() => { setSelected(r.place); setQuery(''); }}
                  disabled={r.place.id === from.id}
                  className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-theme-dim disabled:opacity-40 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-theme-muted" />
                  <div className="min-w-0">
                    {r.place.iata && <span className="font-mono text-sm text-theme-primary">{r.place.iata}</span>}
                    <span className="text-xs text-theme-secondary ml-2">{r.place.city}, {r.place.country}</span>
                    <span className="text-[10px] text-theme-muted ml-2">{r.place.kind}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="relative h-[52vh] shrink-0">
          <MapContainer
            center={[from.lat, from.lng]}
            zoom={2}
            minZoom={2}
            worldCopyJump
            className="w-full h-full"
            zoomControl={false}
            attributionControl={false}
            style={{ background: 'var(--map-bg)' }}
          >
            <TileLayer url={mode === 'dark'
              ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'} />
            <MapResizer />
            <FlyTo target={selected} />

            {routeLatLngs.length > 1 && (
              <Polyline
                positions={routeLatLngs}
                pathOptions={{ color: '#3b82f6', weight: 2, opacity: 0.8, dashArray: '8 6' }}
              />
            )}

            {places.map((p) => {
              const isFrom = p.id === from.id;
              const isSel = selected?.id === p.id;
              return (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lng]}
                  icon={isFrom ? fromIcon : isSel ? selectedIcon : p.kind === 'airport' && p.regional ? regionalIcon : dotIcon}
                  eventHandlers={{ click: () => { if (!isFrom) setSelected(p); } }}
                >
                  <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent={isFrom || isSel}>
                    {p.iata && <span className="font-mono text-[11px]">{p.iata}</span>}
                    <span className="text-[10px] text-theme-secondary"> · {p.city}</span>
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Confirm bar */}
        <div className="p-4 border-t border-theme-border">
          {selected ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono font-bold text-theme-primary">{from.iata ?? from.city}</span>
                  <ArrowRight className="w-4 h-4 text-theme-muted" />
                  <span className="font-mono font-bold text-theme-accent">{selected.iata ?? selected.city}</span>
                  <span className="text-theme-secondary truncate">— {selected.city}, {selected.country}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-theme-muted">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{formatDistance(distance)}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(duration)}</span>
                  <span>Bearing {Math.round(bearing)}°</span>
                </div>
                {/* Transport mode selector */}
                <div className="flex gap-1.5 mt-2">
                  {availableModes.map((m) => {
                    const Icon = m === 'fly' ? Plane : m === 'drive' ? Car : Anchor;
                    const label = m === 'fly' ? 'Fly' : m === 'drive' ? 'Drive' : 'Sail';
                    return (
                      <button
                        key={m}
                        onClick={() => setSelectedMode(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                          selectedMode === m
                            ? 'bg-theme-accent-soft text-theme-accent border border-theme-accent-border'
                            : 'bg-theme-dim text-theme-muted border border-theme-border hover:text-theme-secondary'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => onSelect(selected, selectedMode)}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-sky-400 to-sky-500 hover:shadow-glow text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shrink-0"
              >
                {selectedMode === 'fly' ? <Plane className="w-4 h-4" /> : selectedMode === 'drive' ? <Car className="w-4 h-4" /> : <Anchor className="w-4 h-4" />}
                {selectedMode === 'fly' ? 'Fly' : selectedMode === 'drive' ? 'Drive' : 'Sail'} to {selected.iata ?? selected.city}
              </button>
            </div>
          ) : (
            <p className="text-center text-sm text-theme-muted">Tap a place on the map or search to pick where you'll go next.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
