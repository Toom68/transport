import { useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Search, Plane, Car, Anchor, MapPin, Clock, ArrowRight, Loader2 } from 'lucide-react';
import type { Place, JourneyType } from '@/types/place';
import { places } from '@/data/places';
import { getAvailableJourneyTypes, getDefaultJourneyType } from '@/data/places';
import {
  greatCircleDistance, estimateDuration, initialBearing, generateRoutePoints,
} from '@/engine/navigation';
import { formatDuration, formatDistance } from '@/engine/simulation';
import { searchPlaces } from '@/utils/search';
import { searchMapboxPlaces, reverseGeocode } from '@/utils/geocode';
import { useThemeStore } from '@/store/themeStore';

interface WorldMapPickerProps {
  from: Place;
  onSelect: (place: Place, journeyType: JourneyType, customDeparture?: Place) => void;
  onClose: () => void;
  allowStartSelection?: boolean;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? '';

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

const customStartIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#f59e0b;border:2px solid #fcd34d;border-radius:50%;box-shadow:0 0 12px rgba(245,158,11,0.8); display:flex; align-items:center; justify-content:center;"><span style="font-size:9px; color:#fff; font-weight:bold;">S</span></div>`,
  className: 'ff-cstart',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const customDestIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#3b82f6;border:2px solid #93c5fd;border-radius:50%;box-shadow:0 0 12px rgba(59,130,246,0.8); display:flex; align-items:center; justify-content:center;"><span style="font-size:9px; color:#fff; font-weight:bold;">D</span></div>`,
  className: 'ff-cdest',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FlyTo({ target }: { target: Place | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 3), { duration: 0.8 });
  }, [target, map]);
  return null;
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
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

export function WorldMapPicker({ from, onSelect, onClose, allowStartSelection = false }: WorldMapPickerProps) {
  const { mode } = useThemeStore();
  const [selected, setSelected] = useState<Place | null>(null);
  const [customDeparture, setCustomDeparture] = useState<Place | null>(null);
  const [query, setQuery] = useState('');
  const [mapboxResults, setMapboxResults] = useState<Place[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [selectingStart, setSelectingStart] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveFrom = customDeparture ?? from;

  // Local search results (predefined places)
  const localResults = useMemo(
    () => (query.length > 0 ? searchPlaces(query, 6) : []),
    [query]
  );

  // Debounced Mapbox geocoding search
  useEffect(() => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (query.length < 3 || !MAPBOX_TOKEN) {
      setMapboxResults([]);
      return;
    }
    setIsGeocoding(true);
    geocodeTimer.current = setTimeout(async () => {
      const results = await searchMapboxPlaces(query, MAPBOX_TOKEN, 6);
      setMapboxResults(results);
      setIsGeocoding(false);
    }, 350);
    return () => { if (geocodeTimer.current) clearTimeout(geocodeTimer.current); };
  }, [query]);

  // Combine local and Mapbox results, deduplicating by id
  const allResults = useMemo(() => {
    const seen = new Set<string>();
    const combined: { place: Place; isMapbox: boolean }[] = [];
    for (const r of localResults) {
      if (!seen.has(r.place.id)) {
        seen.add(r.place.id);
        combined.push({ place: r.place, isMapbox: false });
      }
    }
    for (const p of mapboxResults) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        combined.push({ place: p, isMapbox: true });
      }
    }
    return combined;
  }, [localResults, mapboxResults]);

  const distance = selected
    ? greatCircleDistance(effectiveFrom.lat, effectiveFrom.lng, selected.lat, selected.lng)
    : 0;
  const availableJourneyTypes = selected ? getAvailableJourneyTypes(effectiveFrom, selected) : [];
  const defaultJourneyType = selected ? getDefaultJourneyType(effectiveFrom, selected) : 'fly';
  const [selectedJourneyType, setSelectedJourneyType] = useState<JourneyType>('fly');

  useEffect(() => {
    if (selected) setSelectedJourneyType(defaultJourneyType);
  }, [selected, defaultJourneyType]);

  const duration = distance > 0 ? estimateDuration(distance, selectedJourneyType) : 0;
  const bearing = selected ? initialBearing(effectiveFrom.lat, effectiveFrom.lng, selected.lat, selected.lng) : 0;

  const routeLatLngs: [number, number][] = useMemo(() => {
    if (!selected) return [];
    return generateRoutePoints(effectiveFrom.lat, effectiveFrom.lng, selected.lat, selected.lng, 64).map(
      (p) => [p.lat, p.lng] as [number, number]
    );
  }, [effectiveFrom, selected]);

  // Handle map click — place a pin with reverse geocoding
  const handleMapClick = async (lat: number, lng: number) => {
    if (selectingStart) {
      // Placing a custom start pin
      setIsReverseGeocoding(true);
      const place = await reverseGeocode(lat, lng, MAPBOX_TOKEN);
      setIsReverseGeocoding(false);
      const startPlace: Place = place
        ? place
        : {
            id: `custom-start-${lat.toFixed(4)}-${lng.toFixed(4)}`,
            kind: 'city',
            name: `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
            city: `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
            country: '',
            lat,
            lng,
            timezone: 'Etc/GMT+0',
          };
      setCustomDeparture(startPlace);
      setSelected(null);
      setSelectingStart(false);
    } else {
      // Placing a destination pin
      setIsReverseGeocoding(true);
      const place = await reverseGeocode(lat, lng, MAPBOX_TOKEN);
      setIsReverseGeocoding(false);
      const destPlace: Place = place
        ? place
        : {
            id: `custom-dest-${lat.toFixed(4)}-${lng.toFixed(4)}`,
            kind: 'city',
            name: `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
            city: `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
            country: '',
            lat,
            lng,
            timezone: 'Etc/GMT+0',
          };
      setSelected(destPlace);
    }
  };

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
            <span className="text-sm font-serif font-medium text-theme-primary">Choose your destination</span>
            <span className="text-xs text-theme-muted">from {effectiveFrom.city}{customDeparture ? ' (custom)' : ` (${effectiveFrom.iata ?? effectiveFrom.id})`}</span>
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
              placeholder="Search any address, city, or place worldwide..."
              className="w-full pl-10 pr-10 py-2.5 bg-theme-dim border border-theme-border rounded-lg text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border text-sm"
            />
            {isGeocoding && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted animate-spin" />
            )}
          </div>
          {allResults.length > 0 && (
            <div className="absolute left-3 right-3 mt-1 z-[1200] bg-theme-panel-solid border border-theme-border rounded-lg shadow-panel overflow-hidden max-h-64 overflow-y-auto">
              {allResults.map(({ place: p, isMapbox }) => (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p); setQuery(''); setMapboxResults([]); }}
                  disabled={p.id === effectiveFrom.id}
                  className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-theme-dim disabled:opacity-40 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-theme-muted shrink-0" />
                  <div className="min-w-0">
                    {p.iata && <span className="font-mono text-sm text-theme-primary">{p.iata}</span>}
                    <span className="text-xs text-theme-secondary ml-2">{p.city}, {p.country}</span>
                    <span className="text-[10px] text-theme-muted ml-2">{isMapbox ? 'address' : p.kind}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="relative h-[52vh] shrink-0">
          <MapContainer
            center={[effectiveFrom.lat, effectiveFrom.lng]}
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
            <MapClickHandler onMapClick={handleMapClick} />

            {routeLatLngs.length > 1 && (
              <Polyline
                positions={routeLatLngs}
                pathOptions={{ color: '#3b82f6', weight: 2, opacity: 0.8, dashArray: '8 6' }}
              />
            )}

            {places.map((p) => {
              const isFrom = p.id === effectiveFrom.id;
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

            {/* Custom departure marker */}
            {customDeparture && (
              <Marker position={[customDeparture.lat, customDeparture.lng]} icon={customStartIcon}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                  <span className="text-[10px] text-theme-secondary">{customDeparture.city}</span>
                </Tooltip>
              </Marker>
            )}

            {/* Custom destination marker (from map click) */}
            {selected && selected.id.startsWith('custom-dest-') && (
              <Marker position={[selected.lat, selected.lng]} icon={customDestIcon}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                  <span className="text-[10px] text-theme-secondary">{selected.city}</span>
                </Tooltip>
              </Marker>
            )}
          </MapContainer>

          {/* Reverse geocoding loading indicator */}
          {isReverseGeocoding && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1500] bg-theme-panel-solid border border-theme-border rounded-lg px-4 py-2 flex items-center gap-2 shadow-panel">
              <Loader2 className="w-4 h-4 text-theme-accent animate-spin" />
              <span className="text-xs text-theme-secondary">Resolving location...</span>
            </div>
          )}

          {/* Start selection mode indicator */}
          {selectingStart && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1500] bg-amber-500/90 text-white rounded-lg px-4 py-2 flex items-center gap-2 shadow-panel">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-medium">Click on the map to set your starting point</span>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectingStart(false); }}
                className="ml-2 text-white/80 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Confirm bar */}
        <div className="p-4 border-t border-theme-border">
          {allowStartSelection && (
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => { setSelectingStart(true); setSelected(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                  selectingStart
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                    : 'bg-theme-dim text-theme-muted border border-theme-border hover:text-theme-secondary'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                {customDeparture ? 'Change start' : 'Set custom start'}
              </button>
              {customDeparture && (
                <button
                  onClick={() => { setCustomDeparture(null); }}
                  className="px-2 py-1.5 rounded-lg text-xs text-theme-muted hover:text-theme-secondary transition-colors"
                >
                  Reset to {from.city}
                </button>
              )}
            </div>
          )}
          {selected ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono font-bold text-theme-primary">{effectiveFrom.iata ?? effectiveFrom.city}</span>
                  <ArrowRight className="w-4 h-4 text-theme-muted" />
                  <span className="font-mono font-bold text-theme-accent">{selected.iata ?? selected.city}</span>
                  <span className="text-theme-secondary truncate">— {selected.city}, {selected.country}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-theme-muted">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{formatDistance(distance)}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(duration)}</span>
                  <span>Bearing {Math.round(bearing)}°</span>
                </div>
                {/* Transport journey type selector */}
                <div className="flex gap-1.5 mt-2">
                  {availableJourneyTypes.map((m) => {
                    const Icon = m === 'fly' ? Plane : m === 'drive' ? Car : Anchor;
                    const label = m === 'fly' ? 'Fly' : m === 'drive' ? 'Drive' : 'Sail';
                    return (
                      <button
                        key={m}
                        onClick={() => setSelectedJourneyType(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                          selectedJourneyType === m
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
                onClick={() => onSelect(selected, selectedJourneyType, customDeparture ?? undefined)}
                className="w-full sm:w-auto px-6 py-3 btn-primary rounded-xl flex items-center justify-center gap-2 shrink-0"
              >
                {selectedJourneyType === 'fly' ? <Plane className="w-4 h-4" /> : selectedJourneyType === 'drive' ? <Car className="w-4 h-4" /> : <Anchor className="w-4 h-4" />}
                {selectedJourneyType === 'fly' ? 'Fly' : selectedJourneyType === 'drive' ? 'Drive' : 'Sail'} to {selected.iata ?? selected.city}
              </button>
            </div>
          ) : (
            <p className="text-center text-sm text-theme-muted">
              {selectingStart
                ? 'Click anywhere on the map to set your starting point.'
                : 'Click on the map, tap a place marker, or search any address worldwide.'}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
