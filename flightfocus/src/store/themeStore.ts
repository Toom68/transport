import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'dark' | 'light';

interface ThemeStore {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

function applyThemeClass(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      toggle: () => {
        const next = get().mode === 'dark' ? 'light' : 'dark';
        applyThemeClass(next);
        set({ mode: next });
      },
      setMode: (mode) => {
        applyThemeClass(mode);
        set({ mode });
      },
    }),
    {
      name: 'theme-preference',
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeClass(state.mode);
      },
    }
  )
);

// Apply theme on module load (before React renders)
if (typeof document !== 'undefined') {
  const stored = localStorage.getItem('theme-preference');
  let mode: ThemeMode = 'dark';
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.state?.mode === 'light' || parsed?.state?.mode === 'dark') {
        mode = parsed.state.mode;
      }
    } catch {
      // default to dark
    }
  }
  applyThemeClass(mode);
}
