import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, VolumeX, ChevronDown, Sparkles, Headphones, Moon, CloudRain, PlaneTakeoff, Wand2,
} from 'lucide-react';
import {
  useAudioStore, CHANNEL_ENGINE_OPTIONS, AUDIO_PRESETS,
  SAMPLE_LOOP_OPTIONS, SAMPLE_FALLBACK_NOISE, ONE_SHOT_SAMPLES,
} from '@/store/audioStore';
import { useFlightStore } from '@/store/flightStore';
import { useThemeStore } from '@/store/themeStore';
import { audioEngine } from '@/utils/audio';
import type { AudioChannel, AudioPreset } from '@/types/simulation';
import type { FlightPhase } from '@/types/flight';

// Auto (phase-driven) channel volumes. Channels not listed are left to the user.
type AutoMap = Partial<Record<string, number>>;
const PHASE_AUTO: Record<FlightPhase, AutoMap> = {
  BOARDING: { boarding: 0.6, engine: 0, hvac: 0.2, cabin: 0.15, wind: 0, pressure: 0 },
  TAXI: { boarding: 0.1, engine: 0.3, hvac: 0.25, cabin: 0.2, wind: 0, pressure: 0 },
  TAKEOFF: { boarding: 0, engine: 0.85, hvac: 0.3, cabin: 0.1, wind: 0.3, pressure: 0 },
  CLIMB: { boarding: 0, engine: 0.6, hvac: 0.35, cabin: 0.2, wind: 0.35, pressure: 0.4 },
  CRUISE: { boarding: 0, engine: 0.45, hvac: 0.45, cabin: 0.3, wind: 0.4, pressure: 0 },
  DESCENT: { boarding: 0, engine: 0.4, hvac: 0.35, cabin: 0.25, wind: 0.3, pressure: 0.4 },
  APPROACH: { boarding: 0, engine: 0.45, hvac: 0.3, cabin: 0.2, wind: 0.15, pressure: 0.2 },
  LANDING: { boarding: 0, engine: 0.55, hvac: 0.25, cabin: 0.15, wind: 0.1, pressure: 0 },
  ARRIVED: { boarding: 0.4, engine: 0.08, hvac: 0.15, cabin: 0.2, wind: 0, pressure: 0 },
};

const ENGINE_FILTER_BY_PHASE: Partial<Record<FlightPhase, number>> = {
  BOARDING: 80, TAXI: 110, TAKEOFF: 220, CLIMB: 170, CRUISE: 130,
  DESCENT: 110, APPROACH: 140, LANDING: 170, ARRIVED: 70,
};

const PRESET_ICONS: Record<AudioPreset, typeof Sparkles> = {
  auto: Sparkles,
  focus: Headphones,
  night: Moon,
  stormy: CloudRain,
  takeoff: PlaneTakeoff,
  silent: VolumeX,
};

const GROUPS: { label: string; category: AudioChannel['category'] }[] = [
  { label: 'Engine', category: 'engine' },
  { label: 'Cabin', category: 'cabin' },
  { label: 'Weather', category: 'weather' },
  { label: 'Environment', category: 'environment' },
];

export function AudioMixer() {
  const {
    channels, masterVolume, isInitialized, activePreset,
    setMasterVolume, setChannelVolume, toggleChannelMute, setInitialized, setPreset,
  } = useAudioStore();
  const { phase, isActive } = useFlightStore();
  const { mode } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);

  // Initialize the engine + all channels once.
  useEffect(() => {
    if (isInitialized) return;
    let cancelled = false;
    const init = async () => {
      await audioEngine.initialize();
      if (cancelled) return;
      // Synthesized noise channels (wind, cabin, hvac, turbulence, pressure).
      for (const [id, opts] of Object.entries(CHANNEL_ENGINE_OPTIONS)) {
        if (!audioEngine.hasChannel(id)) audioEngine.createNoiseChannel(id, opts);
      }
      // Looping sample channels (engine, boarding, rain) — fall back to noise on failure.
      for (const [id, opts] of Object.entries(SAMPLE_LOOP_OPTIONS)) {
        if (audioEngine.hasChannel(id)) continue;
        const ok = await audioEngine.createSampleChannel(id, opts);
        if (cancelled) return;
        if (!ok && SAMPLE_FALLBACK_NOISE[id]) {
          audioEngine.createNoiseChannel(id, SAMPLE_FALLBACK_NOISE[id]);
        }
      }
      // Preload one-shots so the first chime/takeoff/landing/thunder is gap-free.
      Object.values(ONE_SHOT_SAMPLES).forEach((url) => { void audioEngine.loadSample(url); });
      audioEngine.scheduleRandomBumps('turbulence', 7000, 24000, 1.9);
      setInitialized(true);
    };
    init();
    return () => { cancelled = true; };
  }, [isInitialized, setInitialized]);

  // Cabin chimes + takeoff/landing one-shots fired on phase transitions.
  const prevPhaseRef = useRef<FlightPhase | null>(null);
  useEffect(() => {
    if (!isInitialized) {
      prevPhaseRef.current = phase;
      return;
    }
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (!isActive || prev === null || prev === phase) return;

    const vol = Math.max(0.25, masterVolume);
    audioEngine.resume();

    if (phase === 'TAKEOFF') {
      // Seatbelt chime after taxi, then the takeoff roll.
      void audioEngine.playOneShot(ONE_SHOT_SAMPLES.chime, { gain: vol });
      window.setTimeout(() => audioEngine.playOneShot(ONE_SHOT_SAMPLES.takeoff, { gain: vol }), 1300);
    } else if (phase === 'DESCENT') {
      // "Beginning descent" chime.
      void audioEngine.playOneShot(ONE_SHOT_SAMPLES.chime, { gain: vol });
    } else if (phase === 'LANDING') {
      // Actual landing.
      void audioEngine.playOneShot(ONE_SHOT_SAMPLES.landing, { gain: vol });
    }
  }, [phase, isActive, isInitialized, masterVolume]);

  // Distant-thunder one-shots, scheduled randomly while the Thunder channel is audible.
  useEffect(() => {
    if (!isInitialized) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const wait = 14000 + Math.random() * 32000;
      timer = setTimeout(() => {
        const state = useAudioStore.getState();
        const thunderCh = state.channels.find((c) => c.id === 'thunder');
        const eff = thunderCh && !thunderCh.isMuted ? thunderCh.volume * state.masterVolume : 0;
        if (eff > 0.01) {
          void audioEngine.playOneShot(ONE_SHOT_SAMPLES.thunder, { gain: Math.min(1, eff * 1.2) });
        }
        arm();
      }, wait);
    };
    arm();
    return () => clearTimeout(timer);
  }, [isInitialized]);

  // Push channel volumes / mutes to the engine whenever they change.
  useEffect(() => {
    if (!isInitialized) return;
    channels.forEach((ch) => {
      const eff = ch.isMuted ? 0 : ch.volume * masterVolume;
      audioEngine.setChannelVolume(ch.id, eff, 0.8);
    });
  }, [channels, masterVolume, isInitialized]);

  // Auto (phase-driven) mode: drive managed channels from the flight phase.
  // While grounded, treat it as gate ambience (BOARDING profile).
  const effectivePhase: FlightPhase = isActive ? phase : 'BOARDING';
  useEffect(() => {
    if (!isInitialized || activePreset !== 'auto') return;
    const targets = PHASE_AUTO[effectivePhase];
    for (const [id, vol] of Object.entries(targets)) {
      if (vol === undefined) continue;
      setChannelVolume(id, vol);
    }
    const ef = ENGINE_FILTER_BY_PHASE[effectivePhase];
    if (ef) audioEngine.setChannelFilter('engine', ef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePhase, activePreset, isInitialized]);

  const handleInteraction = () => { audioEngine.resume(); };

  // Stop all audio when leaving the simulation view.
  useEffect(() => {
    return () => {
      if (!isInitialized) return;
      channels.forEach((ch) => {
        audioEngine.setChannelVolume(ch.id, 0, 0.5);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  const presetList: AudioPreset[] = ['auto', 'focus', 'night', 'stormy', 'takeoff', 'silent'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleInteraction}
      className="lg:flex-1 lg:min-h-0 max-h-[70vh] lg:max-h-none flex flex-col bg-theme-panel backdrop-blur-xl border border-theme-border rounded-xl p-4 shadow-panel overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCollapsed((c) => !c)} className="flex items-center gap-2 group">
          <Wand2 className="w-4 h-4 text-theme-accent" />
          <span className="text-sm font-medium text-theme-primary">Soundscape</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-theme-muted transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
        <div className="flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 text-theme-muted" />
          <input
            type="range" min="0" max="1" step="0.05" value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="w-16 h-1 bg-theme-disabled-bg rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-theme-accent"
          />
        </div>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {presetList.map((p) => {
          const Icon = PRESET_ICONS[p];
          const label = p === 'auto' ? 'Auto' : AUDIO_PRESETS[p as Exclude<AudioPreset, 'auto'>].label;
          const active = activePreset === p;
          return (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                active
                  ? 'bg-theme-accent-soft text-theme-accent border-theme-accent-border'
                  : 'bg-theme-dim text-theme-secondary border-transparent hover:text-theme-primary'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {activePreset === 'auto' && (
              <p className="text-[10px] text-theme-muted mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-theme-accent" />
                Auto mode follows your flight phase. Pick a preset to take manual control.
              </p>
            )}

            <div className="space-y-3">
              {GROUPS.map((group) => {
                const groupChannels = channels.filter((c) => c.category === group.category);
                if (groupChannels.length === 0) return null;
                return (
                  <div key={group.category}>
                    <p className="text-[10px] uppercase tracking-wider text-theme-muted mb-1.5">{group.label}</p>
                    <div className="space-y-2">
                      {groupChannels.map((channel) => (
                        <ChannelRow
                          key={channel.id}
                          channel={channel}
                          masterVolume={masterVolume}
                          onToggleMute={() => toggleChannelMute(channel.id)}
                          onVolume={(v) => setChannelVolume(channel.id, v)}
                          mode={mode}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface ChannelRowProps {
  channel: AudioChannel;
  masterVolume: number;
  onToggleMute: () => void;
  onVolume: (v: number) => void;
}

function ChannelRow({ channel, masterVolume, onToggleMute, onVolume, mode }: ChannelRowProps & { mode: string }) {
  const hasOptions = CHANNEL_ENGINE_OPTIONS[channel.id] !== undefined;
  const level = channel.isMuted ? 0 : channel.volume * masterVolume;
  const active = level > 0.01;

  const meterGradient = mode === 'dark'
    ? 'bg-gradient-to-r from-sky-400/60 to-orange-400/60'
    : 'bg-gradient-to-r from-amber-700/50 to-red-500/70';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleMute}
        className={`w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0 ${
          channel.isMuted ? 'bg-theme-disabled-bg text-theme-muted' : 'bg-theme-accent-soft text-theme-accent'
        }`}
        title={hasOptions ? channel.name : undefined}
      >
        {channel.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
      </button>

      <div className="w-20 sm:w-28 shrink-0 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs text-theme-primary truncate">{channel.name}</span>
          {channel.hasLfo && <span className="text-[10px] text-theme-accent/70" title="Modulated">~</span>}
        </div>
        {channel.phaseGated && (
          <span className="text-[9px] text-theme-muted">{channel.phaseGated}</span>
        )}
      </div>

      <div className="flex-1 relative flex items-center">
        {/* level meter behind the slider */}
        <div className="absolute inset-x-0 h-1 bg-theme-disabled-bg rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${meterGradient}`}
            animate={{ width: `${Math.min(100, level * 100)}%`, opacity: active ? [0.55, 0.9, 0.55] : 0.3 }}
            transition={{ width: { duration: 0.4 }, opacity: { duration: 2.4, repeat: active ? Infinity : 0 } }}
          />
        </div>
        <input
          type="range" min="0" max="1" step="0.05" value={channel.volume}
          onChange={(e) => onVolume(parseFloat(e.target.value))}
          className="relative w-full h-1 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-theme-primary [&::-webkit-slider-thumb]:shadow"
        />
      </div>
    </div>
  );
}
