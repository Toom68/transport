import { motion, AnimatePresence } from 'framer-motion';
import { Maximize, Minimize2, Volume2, Settings, Bell, Eye } from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';
import { useAudioStore, AUDIO_PRESETS } from '@/store/audioStore';
import { previewChime } from '@/utils/focusChime';
import type { AudioPreset } from '@/types/simulation';

const AMBIENT_PRESET_OPTIONS: Exclude<AudioPreset, 'auto'>[] = [
  'focus', 'night', 'stormy', 'takeoff', 'silent', 'roadTrip', 'nightDrive', 'cityTraffic',
];

export function FocusSettings({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  const {
    timerConfig,
    setTimerConfig,
    isFullscreen,
    toggleFullscreen,
    isMinimalUI,
    toggleMinimalUI,
    ambientLinkEnabled,
    ambientWorkPreset,
    ambientBreakPreset,
    setAmbientLinkEnabled,
    setAmbientWorkPreset,
    setAmbientBreakPreset,
    alertConfig,
    setAlertConfig,
  } = useFocusStore();

  const { setPreset: setAudioPreset } = useAudioStore();

  return (
    <>
      <button
        onClick={onToggle}
        className={`p-1.5 rounded hover:bg-theme-dim transition-colors ${show ? 'text-theme-accent' : 'text-theme-muted'}`}
      >
        <Settings className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={toggleMinimalUI}
        className="p-1.5 rounded hover:bg-theme-dim text-theme-muted transition-colors"
      >
        {isMinimalUI ? <Maximize className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
      </button>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="space-y-3 p-3 mb-4 surface-soft rounded-lg">
              {/* Timer config */}
              <p className="text-[10px] uppercase tracking-wider text-theme-muted">Timer Durations (minutes)</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-theme-secondary">Work</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(timerConfig.workDuration / 60)}
                    onChange={(e) => setTimerConfig({ workDuration: parseInt(e.target.value, 10) * 60 || 60 })}
                    className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-theme-secondary">Break</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(timerConfig.breakDuration / 60)}
                    onChange={(e) => setTimerConfig({ breakDuration: parseInt(e.target.value, 10) * 60 || 60 })}
                    className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-theme-secondary">Long Break</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(timerConfig.longBreakDuration / 60)}
                    onChange={(e) => setTimerConfig({ longBreakDuration: parseInt(e.target.value, 10) * 60 || 60 })}
                    className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-theme-secondary">Sessions / Long Break</span>
                  <input
                    type="number"
                    min={1}
                    value={timerConfig.sessionsBeforeLongBreak}
                    onChange={(e) => setTimerConfig({ sessionsBeforeLongBreak: parseInt(e.target.value, 10) || 1 })}
                    className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                  />
                </label>
              </div>

              {/* Ambient sound linking */}
              <div className="pt-2 border-t border-theme-border">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-1.5 text-xs text-theme-secondary">
                    <Volume2 className="w-3.5 h-3.5 text-theme-accent" />
                    Link ambient sound
                  </span>
                  <button
                    onClick={() => setAmbientLinkEnabled(!ambientLinkEnabled)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${ambientLinkEnabled ? 'bg-theme-accent' : 'bg-theme-disabled-bg'}`}
                  >
                    <motion.span
                      layout
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                      animate={{ left: ambientLinkEnabled ? '18px' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </label>
                {ambientLinkEnabled && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-theme-secondary">Work preset</span>
                      <select
                        value={ambientWorkPreset}
                        onChange={(e) => setAmbientWorkPreset(e.target.value as AudioPreset)}
                        className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                      >
                        {AMBIENT_PRESET_OPTIONS.map((p) => (
                          <option key={p} value={p}>{AUDIO_PRESETS[p]?.label ?? p}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-theme-secondary">Break preset</span>
                      <select
                        value={ambientBreakPreset}
                        onChange={(e) => setAmbientBreakPreset(e.target.value as AudioPreset)}
                        className="px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                      >
                        {AMBIENT_PRESET_OPTIONS.map((p) => (
                          <option key={p} value={p}>{AUDIO_PRESETS[p]?.label ?? p}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>

              {/* Alert config */}
              <div className="pt-2 border-t border-theme-border">
                <p className="text-[10px] uppercase tracking-wider text-theme-muted mb-2">Session Alerts</p>
                <label className="flex items-center justify-between cursor-pointer mb-2">
                  <span className="flex items-center gap-1.5 text-xs text-theme-secondary">
                    <Bell className="w-3.5 h-3.5 text-theme-accent" />
                    Sound alert
                  </span>
                  <button
                    onClick={() => setAlertConfig({ soundEnabled: !alertConfig.soundEnabled })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${alertConfig.soundEnabled ? 'bg-theme-accent' : 'bg-theme-disabled-bg'}`}
                  >
                    <motion.span
                      layout
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                      animate={{ left: alertConfig.soundEnabled ? '18px' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer mb-2">
                  <span className="flex items-center gap-1.5 text-xs text-theme-secondary">
                    <Eye className="w-3.5 h-3.5 text-theme-accent" />
                    Visual flash
                  </span>
                  <button
                    onClick={() => setAlertConfig({ visualEnabled: !alertConfig.visualEnabled })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${alertConfig.visualEnabled ? 'bg-theme-accent' : 'bg-theme-disabled-bg'}`}
                  >
                    <motion.span
                      layout
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                      animate={{ left: alertConfig.visualEnabled ? '18px' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </label>
                {alertConfig.soundEnabled && (
                  <div className="flex items-center gap-2">
                    <select
                      value={alertConfig.chimeType}
                      onChange={(e) => setAlertConfig({ chimeType: e.target.value as 'bell' | 'chime' | 'soft' })}
                      className="flex-1 px-2 py-1.5 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary focus:outline-none focus:border-theme-accent-border"
                    >
                      <option value="bell">Bell</option>
                      <option value="chime">Chime</option>
                      <option value="soft">Soft pad</option>
                    </select>
                    <button
                      onClick={() => previewChime(alertConfig.chimeType)}
                      className="px-3 py-1.5 rounded-lg bg-theme-accent-soft text-theme-accent text-xs font-medium transition-all duration-200 shrink-0"
                    >
                      Preview
                    </button>
                  </div>
                )}
              </div>

              {/* Fullscreen toggle */}
              <div className="pt-2 border-t border-theme-border">
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 text-xs text-theme-secondary hover:text-theme-primary transition-colors"
                >
                  <Maximize className="w-3.5 h-3.5" />
                  {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
