import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowRight, X, Loader2, AlertCircle } from 'lucide-react';
import { useMultiplayerStore } from '@/store/multiplayerStore';
import { useFlightStore } from '@/store/flightStore';
import { isSupabaseConfigured } from '@/lib/supabase';

interface MultiplayerModalProps {
  onClose: () => void;
}

export function MultiplayerModal({ onClose }: MultiplayerModalProps) {
  const { setPlayerName, createRoom, joinRoom, playerName } = useMultiplayerStore();
  const { setMultiplayerMode, setViewMode } = useFlightStore();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [name, setName] = useState(playerName);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      setPlayerName(name.trim() || 'Host');
      const code = await createRoom();
      setMultiplayerMode('host');
      setViewMode('grounded');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.trim().length !== 6) {
      setError('Room code must be 6 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPlayerName(name.trim() || 'Guest');
      const success = await joinRoom(joinCode);
      if (success) {
        setMultiplayerMode('guest');
        setViewMode('grounded');
        onClose();
      } else {
        const { banned } = useMultiplayerStore.getState();
        setError(banned ? 'You are banned from this room' : 'Room not found or inactive');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
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
          className="w-full max-w-md surface rounded-2xl p-7 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-serif font-semibold text-theme-primary">Fly Together</h3>
            <button onClick={onClose} className="text-theme-muted hover:text-theme-primary">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-start gap-3 p-4 surface-soft rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-theme-primary font-medium">Supabase not configured</p>
              <p className="text-xs text-theme-secondary mt-1">
                Add <code className="font-mono text-theme-accent">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono text-theme-accent">VITE_SUPABASE_ANON_KEY</code> to your{' '}
                <code className="font-mono text-theme-accent">.env</code> file to enable multiplayer.
                Create a free project at supabase.com.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

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
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-theme-accent" />
            <h3 className="text-lg font-serif font-semibold text-theme-primary">Fly Together</h3>
          </div>
          <button onClick={onClose} className="text-theme-muted hover:text-theme-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-theme-secondary font-serif italic text-center">
              Fly together with friends. The host picks the route — everyone follows along.
            </p>
            <button
              onClick={() => setMode('create')}
              className="w-full p-4 surface-soft hover:border-theme-accent-border transition-all rounded-xl flex items-center justify-between group"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-theme-primary">Create a room</p>
                <p className="text-xs text-theme-secondary">Host a flight and share the code</p>
              </div>
              <ArrowRight className="w-4 h-4 text-theme-muted group-hover:text-theme-accent transition-colors" />
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full p-4 surface-soft hover:border-theme-accent-border transition-all rounded-xl flex items-center justify-between group"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-theme-primary">Join a room</p>
                <p className="text-xs text-theme-secondary">Enter a 6-character code</p>
              </div>
              <ArrowRight className="w-4 h-4 text-theme-muted group-hover:text-theme-accent transition-colors" />
            </button>
          </div>
        )}

        {(mode === 'create' || mode === 'join') && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-theme-secondary uppercase tracking-wider mb-2">
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="Enter your name..."
                className="w-full px-4 py-3 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border transition-all"
              />
            </div>

            {mode === 'join' && (
              <div>
                <label className="block text-xs font-medium text-theme-secondary uppercase tracking-wider mb-2">
                  Room code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ABC123"
                  className="w-full px-4 py-3 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-primary text-center text-2xl font-mono tracking-widest placeholder-theme-muted focus:outline-none focus:border-theme-accent-border transition-all"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 surface-soft rounded-lg text-xs text-red-500">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setMode('choose'); setError(null); }}
                className="py-3 px-4 surface-soft text-theme-secondary text-sm font-medium rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={mode === 'create' ? handleCreate : handleJoin}
                disabled={loading || (mode === 'join' && joinCode.length !== 6)}
                className="flex-1 py-3.5 btn-primary rounded-lg disabled:bg-theme-disabled-bg disabled:text-theme-muted disabled:shadow-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {mode === 'create' ? 'Create Room' : 'Join Room'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
