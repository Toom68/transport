import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plane, MapPin } from 'lucide-react';
import type { Place, JourneyType } from '@/types/place';
import { searchPlaces } from '@/utils/search';

interface PlaceSearchProps {
  label: string;
  value: Place | null;
  onChange: (place: Place) => void;
  placeholder?: string;
  filterJourneyType?: JourneyType;
}

export function PlaceSearch({ label, value, onChange, placeholder = 'Search place...', filterJourneyType }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReturnType<typeof searchPlaces>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length > 0) {
      const searchResults = searchPlaces(query, 8, filterJourneyType);
      setResults(searchResults);
      setIsOpen(searchResults.length > 0);
      setSelectedIndex(0);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, filterJourneyType]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (place: Place) => {
    onChange(place);
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
      handleSelect(results[selectedIndex].place);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-theme-secondary uppercase tracking-wider mb-2">
        {label}
      </label>

      {value ? (
        <div
          className="flex items-center gap-3 p-3 bg-theme-dim border border-theme-border rounded-lg cursor-pointer hover:border-theme-accent-border transition-all duration-200"
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
            className="w-full pl-10 pr-4 py-3 bg-theme-dim border border-theme-border rounded-lg text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border focus:ring-1 focus:ring-theme-accent-soft transition-all"
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
            className="absolute z-50 w-full mt-2 bg-theme-panel-solid border border-theme-border rounded-lg shadow-panel overflow-hidden"
          >
            {results.map((result, index) => (
              <button
                key={result.place.id}
                className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-theme-accent-soft border-l-2 border-theme-accent'
                    : 'hover:bg-theme-dim border-l-2 border-transparent'
                }`}
                onClick={() => handleSelect(result.place)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="w-8 h-8 rounded bg-theme-dim flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-theme-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {result.place.iata && <span className="font-mono font-semibold text-theme-primary text-sm">{result.place.iata}</span>}
                    <span className="text-xs text-theme-muted">{result.place.kind}</span>
                    <span className="text-xs text-theme-muted ml-auto">{result.matchField}</span>
                  </div>
                  <p className="text-xs text-theme-secondary truncate">
                    {result.place.name}
                  </p>
                  <p className="text-xs text-theme-muted truncate">
                    {result.place.city}, {result.place.country}
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Backward-compatible alias
export { PlaceSearch as AirportSearch };
