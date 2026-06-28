import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plane, MapPin, Navigation } from 'lucide-react';
import type { Place, JourneyType } from '@/types/place';
import { searchPlaces } from '@/utils/search';
import { googlePlaceAutocomplete, googlePlaceDetails, type GooglePlacePrediction } from '@/utils/googlePlaces';

interface PlaceSearchProps {
  label: string;
  value: Place | null;
  onChange: (place: Place) => void;
  placeholder?: string;
  filterJourneyType?: JourneyType;
}

type SearchResult =
  | { type: 'local'; place: Place; matchField: string }
  | { type: 'google'; prediction: GooglePlacePrediction };

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

export function PlaceSearch({ label, value, onChange, placeholder = 'Search place...', filterJourneyType }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const googleReqIdRef = useRef(0);

  const doSearch = useCallback((q: string) => {
    // Local results are synchronous
    const localResults = searchPlaces(q, 6, filterJourneyType);
    const localMapped: SearchResult[] = localResults.map(r => ({
      type: 'local' as const,
      place: r.place,
      matchField: r.matchField,
    }));

    // Google results are async (only if key is set)
    if (GOOGLE_KEY && q.trim().length >= 2) {
      const reqId = ++googleReqIdRef.current;
      setGoogleLoading(true);
      const types = filterJourneyType === 'fly' ? 'airport' : undefined;
      googlePlaceAutocomplete(q, types).then(predictions => {
        if (reqId !== googleReqIdRef.current) return; // stale response
        setGoogleLoading(false);
        const googleMapped: SearchResult[] = predictions
          .filter(p => !localMapped.some(l => l.type === 'local' && l.place.name.toLowerCase() === p.mainText.toLowerCase()))
          .slice(0, 5)
          .map(p => ({ type: 'google' as const, prediction: p }));
        setResults([...localMapped, ...googleMapped]);
        setIsOpen(localMapped.length > 0 || googleMapped.length > 0);
        setSelectedIndex(0);
      });
    } else {
      setResults(localMapped);
      setIsOpen(localMapped.length > 0);
      setSelectedIndex(0);
    }
  }, [filterJourneyType]);

  useEffect(() => {
    if (query.length > 0) {
      doSearch(query);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, doSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (result: SearchResult) => {
    if (result.type === 'local') {
      onChange(result.place);
    } else {
      // Fetch place details from Google
      const place = await googlePlaceDetails(result.prediction.placeId);
      if (place) onChange(place);
    }
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-serif font-medium text-theme-secondary uppercase tracking-wider mb-2">
        {label}
      </label>

      {value ? (
        <div
          className="flex items-center gap-3 p-3.5 surface-soft border border-theme-border rounded-lg cursor-pointer hover:border-theme-accent-border transition-all duration-200"
          onClick={() => {
            onChange(null as unknown as Place);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
        >
          <div className="w-10 h-10 rounded-lg bg-theme-accent-soft flex items-center justify-center">
            <Plane className="w-5 h-5 text-theme-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {value.iata && <span className="text-lg font-semibold text-theme-primary">{value.iata}</span>}
              <span className="text-xs text-theme-muted">{value.kind}</span>
            </div>
            <p className="text-sm text-theme-secondary truncate">{value.city}, {value.country}</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length > 0 && setIsOpen(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-3 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border focus:ring-1 focus:ring-theme-accent-soft transition-all"
          />
        </div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-theme-panel-solid border border-theme-border rounded-lg shadow-soft overflow-hidden max-h-80 overflow-y-auto"
          >
            {results.map((result, index) => {
              const isLocal = result.type === 'local';
              const place = isLocal ? result.place : null;
              const pred = !isLocal ? result.prediction : null;
              return (
                <button
                  key={isLocal ? place!.id : pred!.placeId}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-theme-accent-soft border-l-2 border-theme-accent'
                      : 'hover:bg-theme-dim border-l-2 border-transparent'
                  }`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="w-8 h-8 rounded bg-theme-dim flex items-center justify-center shrink-0">
                    {isLocal ? (
                      <MapPin className="w-4 h-4 text-theme-muted" />
                    ) : (
                      <Navigation className="w-4 h-4 text-theme-accent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isLocal && place ? (
                      <>
                        <div className="flex items-center gap-2">
                          {place.iata && <span className="font-mono font-semibold text-theme-primary text-sm">{place.iata}</span>}
                          <span className="text-xs text-theme-muted">{place.kind}</span>
                          <span className="text-xs text-theme-muted ml-auto">{result.matchField}</span>
                        </div>
                        <p className="text-xs text-theme-secondary truncate">{place.name}</p>
                        <p className="text-xs text-theme-muted truncate">{place.city}, {place.country}</p>
                      </>
                    ) : pred ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-theme-accent font-medium">Google Places</span>
                        </div>
                        <p className="text-xs text-theme-secondary truncate">{pred.mainText}</p>
                        <p className="text-xs text-theme-muted truncate">{pred.secondaryText}</p>
                      </>
                    ) : null}
                  </div>
                </button>
              );
            })}
            {googleLoading && (
              <div className="flex items-center gap-2 p-3 text-xs text-theme-muted">
                <div className="w-3 h-3 border border-theme-muted border-t-transparent rounded-full animate-spin" />
                Searching more places…
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Backward-compatible alias
export { PlaceSearch as AirportSearch };
