import { useEffect, useState } from 'react';
import { useSpotifyStore } from '@/store/spotifyStore';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function SpotifyCallback() {
  const { handleCallback } = useSpotifyStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      return;
    }

    if (!code) {
      setStatus('error');
      return;
    }

    void (async () => {
      await handleCallback(code);
      setStatus('success');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    })();
  }, [handleCallback]);

  return (
    <div className="fixed inset-0 bg-theme-dim flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
            <p className="text-sm text-theme-secondary">Connecting to Spotify…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-sm text-theme-secondary">Connected! Redirecting…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-sm text-red-500">Connection failed.</p>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="text-xs text-theme-muted hover:text-theme-primary mt-2"
            >
              Back to app
            </button>
          </>
        )}
      </div>
    </div>
  );
}
