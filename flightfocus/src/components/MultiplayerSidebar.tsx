import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Copy, Check, Crown, Pause, Play,
  Square, Gauge, LogOut, UserX, Ban, AlertCircle,
} from 'lucide-react';
import { useMultiplayerStore } from '@/store/multiplayerStore';
import { useFlightStore } from '@/store/flightStore';
import { PlayerAvatar } from './PlayerAvatar';

export function MultiplayerSidebar() {
  const { role, roomCode, players, sessionId, connectionState, kickPlayer, banPlayer, leaveRoom, endRoom } = useMultiplayerStore();
  const { isPaused, timeScale, phase, pauseFlight, resumeFlight, stopFlight, setTimeScale, setMultiplayerMode } = useFlightStore();
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelectedPlayer(null);
      }
    };
    if (selectedPlayer) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedPlayer]);

  if (!role || !roomCode) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEndSim = async () => {
    stopFlight();
    await endRoom();
    setMultiplayerMode('off');
  };

  const speeds = [1, 10, 30, 60, 120, 300];
  const isHost = role === 'host';

  return (
    <>
      {/* Collapsed tab */}
      <AnimatePresence>
        {collapsed && (
          <motion.button
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -60, opacity: 0 }}
            onClick={() => setCollapsed(false)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[2000] glass-panel border-r border-t border-b border-theme-border rounded-r-xl p-2 flex flex-col items-center gap-1"
          >
            <ChevronRight className="w-4 h-4 text-theme-secondary" />
            <span className="text-[10px] font-mono text-theme-accent tracking-wider [writing-mode:vertical-rl]">{roomCode}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded sidebar */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 z-[2000] w-[280px] glass-panel border-r border-theme-border flex flex-col"
          >
            {/* Collapse button */}
            <button
              onClick={() => setCollapsed(true)}
              className="absolute -right-6 top-1/2 -translate-y-1/2 glass-panel border border-theme-border rounded-r-lg p-1.5"
            >
              <ChevronLeft className="w-4 h-4 text-theme-secondary" />
            </button>

            {/* Room code section */}
            <div className="p-4 border-b border-theme-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-theme-muted">Room Code</span>
                {isHost ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-theme-gold">
                    <Crown className="w-3 h-3" /> Host
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-theme-accent">Guest</span>
                )}
              </div>
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-between p-3 surface-soft rounded-lg hover:border-theme-accent-border transition-all"
              >
                <span className="text-xl font-mono font-bold tracking-widest text-theme-primary">{roomCode}</span>
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-theme-muted" />
                )}
              </button>
            </div>

            {/* Player list */}
            <div className="p-4 border-b border-theme-border flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-wider text-theme-muted">Pilots</span>
                <span className="text-xs font-mono text-theme-secondary">{players.length} online</span>
              </div>
              <div className="space-y-1.5">
                {players.map((player) => (
                  <div key={player.id} className="relative">
                    <button
                      onClick={() => isHost && player.id !== sessionId && setSelectedPlayer(player.id === selectedPlayer ? null : player.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                        selectedPlayer === player.id ? 'surface-soft' : 'hover:surface-soft'
                      } ${isHost && player.id !== sessionId ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <PlayerAvatar playerId={player.id} size={32} />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-theme-primary truncate">
                          {player.name}
                          {player.id === sessionId && <span className="text-theme-muted text-xs ml-1">(you)</span>}
                        </p>
                      </div>
                      {player.isHost && (
                        <Crown className="w-3.5 h-3.5 text-theme-gold shrink-0" />
                      )}
                    </button>

                    {/* Kick/Ban popover */}
                    <AnimatePresence>
                      {selectedPlayer === player.id && isHost && player.id !== sessionId && (
                        <motion.div
                          ref={popoverRef}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute left-0 right-0 top-full z-10 mt-1 surface rounded-lg border border-theme-border shadow-panel p-1.5 flex gap-1"
                        >
                          <button
                            onClick={() => { kickPlayer(player.id); setSelectedPlayer(null); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md hover:bg-theme-hover text-xs text-theme-secondary transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5" /> Kick
                          </button>
                          <button
                            onClick={() => { banPlayer(player.id); setSelectedPlayer(null); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md hover:bg-red-500/10 text-xs text-red-500 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" /> Ban
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            {/* Host controls */}
            {isHost && (
              <div className="p-4 border-t border-theme-border space-y-3">
                <div className="surface rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-3.5 h-3.5 text-theme-muted" />
                      <span className="text-xs font-medium text-theme-primary">Sim Controls</span>
                    </div>
                    <span className="text-[10px] font-mono text-theme-accent">{timeScale}x</span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    {phase !== 'ARRIVED' ? (
                      <>
                        <button
                          onClick={isPaused ? resumeFlight : pauseFlight}
                          className="flex-1 py-1.5 bg-theme-accent-soft text-theme-accent text-[11px] font-medium rounded-md transition-all flex items-center justify-center gap-1"
                        >
                          {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                          {isPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          onClick={stopFlight}
                          className="py-1.5 px-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[11px] font-medium rounded-md transition-colors"
                        >
                          <Square className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={stopFlight}
                        className="flex-1 py-1.5 bg-theme-gold-soft hover:bg-theme-gold-medium text-theme-gold text-[11px] font-medium rounded-md transition-all"
                      >
                        New Flight
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {speeds.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setTimeScale(speed)}
                        className={`py-1 px-2 text-[10px] font-mono rounded-full transition-colors ${
                          timeScale === speed
                            ? 'bg-theme-accent text-white'
                            : 'bg-theme-dim text-theme-muted hover:bg-theme-hover'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleEndSim}
                  className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  End Simulation
                </button>
              </div>
            )}

            {/* Guest bottom */}
            {!isHost && (
              <div className="p-4 border-t border-theme-border">
                {connectionState === 'host_disconnected' && (
                  <div className="flex items-center gap-2 p-2.5 surface-soft rounded-lg mb-3 text-xs text-amber-500">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Host disconnected — waiting...
                  </div>
                )}
                <button
                  onClick={() => { leaveRoom(); setMultiplayerMode('off'); }}
                  className="w-full py-2.5 surface-soft hover:bg-theme-hover text-theme-secondary text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Leave Room
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
