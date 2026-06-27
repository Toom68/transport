import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronDown } from 'lucide-react';
import { useSavegameStore } from '@/store/savegameStore';
import { JournalView } from './JournalView';

export function JournalPanel() {
  const save = useSavegameStore((s) => s.saves.find((x) => x.id === s.activeSaveId));
  const [collapsed, setCollapsed] = useState(true);

  if (!save) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="lg:flex-1 lg:min-h-0 max-h-[70vh] lg:max-h-none flex flex-col bg-theme-panel backdrop-blur-xl border border-theme-border rounded-xl p-4 shadow-panel"
    >
      <button onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-theme-accent" />
          <span className="text-sm font-medium text-theme-primary">Journal</span>
          <span className="text-[10px] font-mono text-theme-muted">{save.journalEntries.length}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 max-h-80 overflow-y-auto pr-1">
              <JournalView entries={save.journalEntries} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
