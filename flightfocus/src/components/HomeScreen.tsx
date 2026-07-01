import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Car, Anchor, Plus, Trash2, MapPin, Clock, Trophy, ArrowRight, X, Award, Users } from 'lucide-react';
import { useSavegameStore, MAX_SAVES } from '@/store/savegameStore';
import { useFlightStore } from '@/store/flightStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import { isSpotifyConfigured } from '@/utils/spotify';
import type { SaveGame } from '@/types/savegame';
import type { Place } from '@/types/place';
import { PlaceSearch } from './PlaceSearch';
import { MultiplayerModal } from './MultiplayerModal';

function TransportLogo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none">
        {/* Ring */}
        <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="2.5" className="text-theme-accent-border" />
        {/* Background patches to hide ring behind icons */}
        <circle cx="32" cy="6" r="18" fill="var(--color-panel-solid, #24211c)" />
        <circle cx="9.4" cy="45" r="16" fill="var(--color-panel-solid, #24211c)" />
        <circle cx="54.6" cy="45" r="16" fill="var(--color-panel-solid, #24211c)" />
        {/* Plane — top (90deg) */}
        <g transform="translate(32, 6) scale(3.5)">
          <path d="M0-5l-1.5 3-4 1.2v1l4-.6v2.4l-1 .8v.6l2.5-.5 2.5.5v-.6l-1-.8V-.6l4 .6v-1L1.5-2z" fill="currentColor" className="text-theme-accent" />
        </g>
        {/* Car — bottom left (210deg) */}
        <g transform="translate(9.4, 45) scale(2.98)">
          <path d="M-5 0l.5-2 1.5-1h3l1.5 1 .5 2v2h-7z" fill="currentColor" className="text-theme-accent" />
          <circle cx="-3" cy="2.5" r="1.2" fill="none" stroke="currentColor" strokeWidth="1" className="text-theme-accent" />
          <circle cx="1" cy="2.5" r="1.2" fill="none" stroke="currentColor" strokeWidth="1" className="text-theme-accent" />
        </g>
        {/* Anchor — bottom right (330deg) */}
        <g transform="translate(54.6, 45) scale(2.98)">
          <circle cx="0" cy="-4" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-theme-accent" />
          <line x1="0" y1="-2.5" x2="0" y2="3" stroke="currentColor" strokeWidth="1.5" className="text-theme-accent" />
          <line x1="-2.5" y1="0" x2="2.5" y2="0" stroke="currentColor" strokeWidth="1.5" className="text-theme-accent" />
          <path d="M-3.5 3 Q-3.5 5.5 0 5.5 Q3.5 5.5 3.5 3" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-theme-accent" />
        </g>
      </svg>
    </div>
  );
}

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function formatHours(minutes: number): string {
  const h = minutes / 60;
  if (h < 1) return `${Math.round(minutes)}m`;
  return `${h.toFixed(1)}h`;
}

function uniquePlaceCount(save: SaveGame): number {
  return new Set(save.visitedPlaces.map((v) => v.id)).size;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function HomeScreen() {
  const { saves, createSave, loadSave, deleteSave } = useSavegameStore();
  const { setViewMode, setDeparture, setArrival } = useFlightStore();
  const { connected: spotifyConnected, connect: spotifyConnect, disconnect: spotifyDisconnect } = useSpotifyStore();
  const [showNew, setShowNew] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);

  const sortedSaves = useMemo(
    () => [...saves].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt),
    [saves]
  );

  const handleContinue = (save: SaveGame) => {
    loadSave(save.id);
    setDeparture(save.currentPlace);
    setArrival(null);
    setViewMode('grounded');
  };

  const handleCreate = (name: string, origin: Place) => {
    createSave(name, origin);
    setDeparture(origin);
    setArrival(null);
    setShowNew(false);
    setViewMode('grounded');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-theme-accent-soft border border-theme-accent-border mb-5 shadow-soft"
          >
            <TransportLogo className="w-16 h-16 text-theme-accent" />
          </motion.div>
          <h1 className="text-3xl font-serif font-semibold text-theme-primary mb-2">TransportFocus</h1>
          <p className="text-theme-secondary text-sm font-serif italic">A quiet journey across the world. Pick up where you arrived.</p>
        </div>

        <div className="surface rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-theme-primary">Your journeys</h2>
            <span className="text-xs text-theme-muted font-mono">{saves.length}/{MAX_SAVES}</span>
          </div>

          {sortedSaves.length === 0 && (
            <div className="text-center py-12 text-theme-secondary text-sm">
              No journeys yet. Start a new one below.
            </div>
          )}

          <div className="space-y-2.5">
            {sortedSaves.map((save) => (
              <motion.div
                key={save.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="group flex items-center gap-4 p-4 surface-soft hover:border-theme-accent-border transition-all duration-200"
              >
                <button onClick={() => handleContinue(save)} className="flex-1 flex items-center gap-4 text-left min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-theme-accent-soft flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-theme-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-theme-primary truncate">{save.name}</p>
                    <p className="text-xs text-theme-secondary truncate">
                      Currently in {save.currentPlace.city}
                      <span className="font-mono text-theme-muted"> ({save.currentPlace.iata ?? save.currentPlace.id})</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-theme-muted">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-theme-dim"><Plane className="w-3 h-3" />{save.stats.totalFlights}</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-theme-dim"><MapPin className="w-3 h-3" />{uniquePlaceCount(save)}</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-theme-dim"><Clock className="w-3 h-3" />{formatHours(save.stats.totalAmbientMinutes)}</span>
                      {save.stats.miles > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-theme-gold-soft text-theme-gold"><Award className="w-3 h-3" />{save.stats.miles.toLocaleString()}</span>
                      )}
                      <span className="ml-auto text-xs">{relativeTime(save.lastPlayedAt)}</span>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleContinue(save)}
                    className="w-9 h-9 rounded-lg bg-theme-accent-soft text-theme-accent flex items-center justify-center transition-colors"
                    title="Continue journey"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteSave(save.id)}
                    className="w-9 h-9 rounded-lg bg-theme-dim text-theme-muted flex items-center justify-center opacity-60 lg:opacity-0 lg:group-hover:opacity-100 hover:text-red-400 hover:bg-red-50 transition-all"
                    title="Delete journey"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          <button
            onClick={() => setShowNew(true)}
            disabled={saves.length >= MAX_SAVES}
            className="w-full py-3.5 btn-primary rounded-lg disabled:bg-theme-disabled-bg disabled:text-theme-muted disabled:shadow-none flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Journey
          </button>
          {saves.length >= MAX_SAVES && (
            <p className="text-center text-xs text-theme-muted">Delete a journey to start a new one.</p>
          )}

          <button
            onClick={() => setShowMultiplayer(true)}
            className="w-full py-3.5 surface-soft hover:border-theme-accent-border text-theme-primary rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <Users className="w-5 h-5 text-theme-accent" />
            Fly Together
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mt-8">
          <p className="text-center text-xs text-theme-muted font-serif italic">
            Where you land is where you take off next.
          </p>
          {isSpotifyConfigured() && (
            <button
              onClick={() => spotifyConnected ? spotifyDisconnect() : spotifyConnect()}
              className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                spotifyConnected ? 'text-green-600/80 hover:text-green-600' : 'text-theme-muted hover:text-theme-secondary'
              }`}
            >
              <SpotifyIcon className="w-3 h-3" />
              {spotifyConnected ? 'Spotify connected' : 'Connect Spotify'}
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showNew && (
          <NewJourneyModal onClose={() => setShowNew(false)} onCreate={handleCreate} />
        )}
        {showMultiplayer && (
          <MultiplayerModal onClose={() => setShowMultiplayer(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

interface NewJourneyModalProps {
  onClose: () => void;
  onCreate: (name: string, origin: Place) => void;
}

function NewJourneyModal({ onClose, onCreate }: NewJourneyModalProps) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [name, setName] = useState('');

  const defaultName = origin ? `Journey from ${origin.city}` : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-theme-overlay backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md surface rounded-2xl p-7 space-y-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-serif font-semibold text-theme-primary">Start a new journey</h3>
          <button onClick={onClose} className="text-theme-muted hover:text-theme-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-theme-secondary font-serif italic">
          Choose where your story begins. You'll pick destinations as you go — each landing becomes your next departure.
        </p>

        <PlaceSearch
          label="Starting place"
          value={origin}
          onChange={setOrigin}
          placeholder="Search your starting point..."
        />

        <div>
          <label className="block text-xs font-medium text-theme-secondary uppercase tracking-wider mb-2">
            Journey name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={defaultName || 'My grand tour'}
            className="w-full px-4 py-3 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border transition-all"
          />
        </div>

        <button
          onClick={() => origin && onCreate(name || defaultName, origin)}
          disabled={!origin}
          className="w-full py-3.5 btn-primary rounded-lg disabled:bg-theme-disabled-bg disabled:text-theme-muted disabled:shadow-none flex items-center justify-center gap-2"
        >
          <Plane className="w-5 h-5" />
          Begin
        </button>
      </motion.div>
    </motion.div>
  );
}
