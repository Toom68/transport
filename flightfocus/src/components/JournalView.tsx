import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Loader2, ArrowRight, ChevronDown, MapPin } from 'lucide-react';
import type { JournalEntry } from '@/types/savegame';
import { CitySketch } from './CitySketch';

interface JournalViewProps {
  entries: JournalEntry[];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

export function JournalView({ entries }: JournalViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <BookOpen className="w-7 h-7 text-theme-muted mx-auto mb-2" />
        <p className="text-sm text-theme-muted">Your journal is empty.</p>
        <p className="text-xs text-theme-muted mt-1">Complete a leg to write your first page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {entries.map((entry, i) => {
        const isOpen = expandedId === entry.id;
        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.2) }}
          >
            <button
              onClick={() => setExpandedId(isOpen ? null : entry.id)}
              className={`w-full text-left rounded-lg border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? 'surface-soft border-theme-border'
                  : 'surface-soft border-theme-border hover:border-theme-border-solid'
              }`}
            >
              {/* Collapsed row: route + city + date */}
              <div className="flex items-center gap-3 px-3 py-3">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-theme-panel-solid border border-theme-border flex items-center justify-center">
                  <CitySketch sketchKey={entry.svgKey} className="w-8 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-mono font-semibold text-theme-primary">{entry.fromPlace.iata ?? entry.fromPlace.city}</span>
                    <ArrowRight className="w-3 h-3 text-theme-muted" />
                    <span className="font-mono text-theme-secondary">{entry.toPlace.iata ?? entry.toPlace.city}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-2.5 h-2.5 text-theme-muted" />
                    <span className="text-xs text-theme-secondary truncate">{entry.fromPlace.city}</span>
                  </div>
                </div>
                <span className="text-xs text-theme-muted font-mono shrink-0">{formatDate(entry.createdAt)}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-theme-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </div>

              {/* Expanded content */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-2 border-t border-theme-border">
                      {entry.isGenerating ? (
                        <div className="flex items-center gap-2 text-xs text-theme-muted py-3">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Writing this page…
                        </div>
                      ) : (
                        <p className="text-sm text-theme-secondary leading-relaxed italic font-serif pt-2">{entry.text}</p>
                      )}
                      {entry.isFallback && !entry.isGenerating && (
                        <p className="text-xs text-theme-muted mt-2">offline entry</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
