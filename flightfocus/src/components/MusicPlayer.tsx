import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music2, Play, Pause, SkipForward, SkipBack, Volume2, Loader2, AlertCircle,
  Piano, Disc3, Radio, Cloud, Waves, Film, Sliders,
} from 'lucide-react';
import { useMusicStore, type MusicGenre } from '@/store/musicStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import { isSpotifyConfigured } from '@/utils/spotify';

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

const GENRES: { id: MusicGenre; label: string; icon: typeof Piano }[] = [
  { id: 'classical', label: 'Classical', icon: Piano },
  { id: 'jazz', label: 'Jazz', icon: Disc3 },
  { id: 'lofi', label: 'Lofi', icon: Radio },
  { id: 'ambient', label: 'Ambient', icon: Cloud },
  { id: 'electronic', label: 'Electronic', icon: Waves },
  { id: 'cinematic', label: 'Cinematic', icon: Film },
];

const EQ_BANDS = [
  { freq: 60, label: '60' },
  { freq: 170, label: '170' },
  { freq: 350, label: '350' },
  { freq: 1000, label: '1k' },
  { freq: 3500, label: '3.5k' },
  { freq: 8000, label: '8k' },
  { freq: 16000, label: '16k' },
] as const;

export function MusicPlayer() {
  const {
    genre, tracks, index, isPlaying, volume, status, error,
    loadGenre, toggle, next, prev, setVolume,
  } = useMusicStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [eqValues, setEqValues] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [showEq, setShowEq] = useState(false);

  const current = tracks[index];
  const [buffering, setBuffering] = useState(false);

  // Spotify integration.
  const { connected: spotifyConnected, track: spotifyTrack, connect: spotifyConnect, disconnect: spotifyDisconnect, startPolling: spotifyStartPolling } = useSpotifyStore();
  const spotifyActive = spotifyConnected && spotifyTrack?.isPlaying;

  // Start Spotify polling on mount if already connected.
  useEffect(() => {
    if (spotifyConnected) spotifyStartPolling();
  }, []);

  // When Spotify is playing, pause Jamendo.
  useEffect(() => {
    if (spotifyActive && isPlaying) {
      useMusicStore.getState().pause();
    }
  }, [spotifyActive, isPlaying]);

  // Single effect: sync src + drive play/pause together to avoid race conditions.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !current) return;

    const trackChanged = el.dataset.trackId !== current.id;
    if (trackChanged) {
      el.src = current.streamUrl;
      el.dataset.trackId = current.id;
      el.load(); // start buffering immediately
      setBuffering(true);
    }

    if (isPlaying) {
      const tryPlay = (retries = 3) => {
        el.play().catch((err) => {
          if (err.name === 'AbortError' && retries > 0) {
            // Browser hasn't finished processing new src — retry shortly
            setTimeout(() => tryPlay(retries - 1), 300);
          }
          // NotAllowedError = autoplay blocked; user needs to click play
        });
      };
      tryPlay();
    } else {
      el.pause();
    }
  }, [current, isPlaying]);

  // Keep element volume in sync.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Apply EQ via Web Audio API filter chain — initialize once on mount.
  const eqRef = useRef<{ ctx: AudioContext; filters: BiquadFilterNode[] } | null>(null);
  const eqValuesRef = useRef(eqValues);
  eqValuesRef.current = eqValues;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const ctx = new AudioContext();
    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(el);
    } catch {
      // Source already created — can't create twice, abort.
      ctx.close();
      return;
    }

    const freqs = EQ_BANDS.map((b) => b.freq);
    const filters = freqs.map((freq, i) => {
      const f = ctx.createBiquadFilter();
      f.type = i === 0 ? 'lowshelf' : i === freqs.length - 1 ? 'highshelf' : 'peaking';
      f.frequency.value = freq;
      f.Q.value = 1;
      f.gain.value = eqValuesRef.current[i] ?? 0;
      return f;
    });

    source.connect(filters[0]);
    filters.reduce((a, b) => { a.connect(b); return b; });
    filters[filters.length - 1].connect(ctx.destination);
    eqRef.current = { ctx, filters };

    // Resume context on any user interaction (browsers suspend it by default).
    const resumeCtx = () => { void ctx.resume(); };
    document.addEventListener('click', resumeCtx);
    document.addEventListener('touchstart', resumeCtx);

    return () => {
      document.removeEventListener('click', resumeCtx);
      document.removeEventListener('touchstart', resumeCtx);
    };
  }, []);

  // Also resume the AudioContext when playback starts.
  useEffect(() => {
    if (isPlaying && eqRef.current?.ctx.state === 'suspended') {
      void eqRef.current.ctx.resume();
    }
  }, [isPlaying]);

  // Update filter gains when EQ values change.
  useEffect(() => {
    if (!eqRef.current) return;
    eqRef.current.filters.forEach((f, i) => {
      f.gain.value = eqValues[i] ?? 0;
    });
  }, [eqValues]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="lg:flex-1 lg:min-h-0 max-h-[70vh] lg:max-h-none flex flex-col bg-theme-panel backdrop-blur-xl border border-theme-border rounded-xl p-4 shadow-panel"
    >
      <audio
        ref={audioRef}
        onEnded={next}
        preload="auto"
        crossOrigin="anonymous"
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-theme-accent" />
          <span className="text-sm font-medium text-theme-primary">Focus Music</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isSpotifyConfigured() && (
            <button
              onClick={() => spotifyConnected ? spotifyDisconnect() : spotifyConnect()}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all duration-200 ${
                spotifyConnected
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'bg-theme-dim text-theme-secondary hover:text-theme-primary'
              }`}
              title={spotifyConnected ? 'Disconnect Spotify' : 'Connect Spotify'}
            >
              <SpotifyIcon className="w-3 h-3" />
              {spotifyConnected ? 'On' : 'Spotify'}
            </button>
          )}
          <button
            onClick={() => setShowEq((s) => !s)}
            className={`p-1.5 rounded transition-all duration-200 ${showEq ? 'bg-theme-accent-soft text-theme-accent' : 'text-theme-muted hover:text-theme-primary'}`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
          <Volume2 className="w-3.5 h-3.5 text-theme-muted" />
          <input
            type="range" min="0" max="1" step="0.05" value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 h-1 bg-theme-disabled-bg rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-theme-accent"
          />
        </div>
      </div>

      {/* Genre chips */}
      <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
        {GENRES.map((g) => {
          const Icon = g.icon;
          const active = genre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => loadGenre(g.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 border ${
                active
                  ? 'bg-theme-accent-soft text-theme-accent border-theme-accent-border shadow-glow'
                  : 'bg-theme-dim text-theme-secondary border-transparent hover:text-theme-primary'
              }`}
            >
              <Icon className="w-3 h-3" />
              {g.label}
            </button>
          );
        })}
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {status === 'idle' && !spotifyConnected && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <Music2 className="w-10 h-10 text-theme-muted mb-3" />
            <p className="text-xs text-theme-muted max-w-[200px]">Pick a genre to stream quiet, instrumental focus music.</p>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-theme-accent animate-spin mb-3" />
            <p className="text-xs text-theme-muted">Loading tracks…</p>
          </div>
        )}

        {status === 'error' && !spotifyConnected && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <AlertCircle className="w-8 h-8 text-amber-500/60 mb-3" />
            <p className="text-xs text-amber-600">Music unavailable{error ? ` (${error})` : ''}.</p>
            <p className="text-[10px] text-theme-muted mt-1">Available when deployed to Netlify.</p>
          </div>
        )}

        {/* Unified track display — works for both Jamendo and Spotify */}
        {((status === 'ready' && current) || (spotifyConnected && spotifyTrack)) && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Track info — same layout, swapped content */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center py-4">
              <motion.div
                key={spotifyActive ? spotifyTrack!.id : current?.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-20 h-20 rounded-2xl border border-theme-border flex items-center justify-center mb-4 overflow-hidden shadow-glow"
              >
                {spotifyActive ? (
                  spotifyTrack!.albumArt ? (
                    <img src={spotifyTrack!.albumArt} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <SpotifyIcon className="w-8 h-8 text-green-500/70" />
                  )
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-sky-100 to-slate-100 flex items-center justify-center">
                    <Music2 className="w-8 h-8 text-theme-accent/70" />
                  </div>
                )}
              </motion.div>
              <p className="text-sm font-medium text-theme-primary max-w-full truncate px-2">
                {spotifyActive ? spotifyTrack!.title : current?.title}
              </p>
              <p className="text-xs text-theme-muted max-w-full truncate px-2 mt-0.5">
                {spotifyActive ? spotifyTrack!.artist : current?.artist}
              </p>
              {spotifyActive && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-green-500/80 font-mono">Spotify</span>
                </div>
              )}
            </div>

            {/* Playback controls — same for both */}
            <div className="flex items-center justify-center gap-3 py-3 shrink-0">
              <button
                onClick={prev}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-theme-dim text-theme-secondary hover:text-theme-primary hover:bg-theme-disabled-bg transition-all duration-200"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={toggle}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-theme-accent-soft text-theme-accent hover:bg-theme-accent-soft transition-all duration-200 shadow-glow"
              >
                {buffering ? <Loader2 className="w-5 h-5 animate-spin" /> : isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={next}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-theme-dim text-theme-secondary hover:text-theme-primary hover:bg-theme-disabled-bg transition-all duration-200"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center text-[10px] text-theme-muted font-mono shrink-0">
              {spotifyActive ? 'via Spotify' : `${index + 1} / ${tracks.length}`}
            </div>
          </div>
        )}

        {/* Spotify connected but nothing playing */}
        {spotifyConnected && !spotifyTrack && status !== 'ready' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <SpotifyIcon className="w-8 h-8 text-green-500/40 mb-3" />
            <p className="text-xs text-theme-muted">Connected to Spotify. Play something in Spotify to see it here.</p>
          </div>
        )}
      </div>

      {/* 7-band EQ — pinned at bottom, sized like simulation controls */}
      <AnimatePresence>
        {showEq && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="pt-3 mt-3 border-t border-theme-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-theme-muted">Equalizer · Hz</span>
                <button
                  onClick={() => setEqValues([0, 0, 0, 0, 0, 0, 0])}
                  className="text-[10px] text-theme-muted hover:text-theme-accent transition-colors"
                >
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {EQ_BANDS.map((band, i) => (
                  <div key={band.freq} className="flex flex-col items-center gap-1">
                    {/* Vertical slider column */}
                    <div className="relative h-16 flex items-center justify-center bg-theme-dim rounded">
                      {/* Center reference line */}
                      <div className="absolute inset-x-1 top-1/2 h-px bg-theme-border-solid" />
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={eqValues[i]}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          setEqValues((prev) => {
                            const next = [...prev];
                            next[i] = v;
                            return next;
                          });
                        }}
                        className="eq-vertical-slider"
                        style={{
                          writingMode: 'vertical-lr' as const,
                          direction: 'rtl',
                          width: '100%',
                          height: '56px',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                    {/* Hz label under each column */}
                    <span className="text-[9px] text-theme-muted font-mono leading-none">{band.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
