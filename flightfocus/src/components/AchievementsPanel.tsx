import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lock, HelpCircle, Trophy, type LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { ACHIEVEMENTS, type Achievement, type AchievementCategory } from '@/data/achievements';

interface AchievementsPanelProps {
  unlocked: string[];
  unlockedAt?: Record<string, number>;
}

function iconByName(name: string): LucideIcon {
  const map = Icons as unknown as Record<string, LucideIcon>;
  return map[name] ?? Trophy;
}

const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  geographic: 'Geographic',
  ambient: 'Ambient',
  hidden: 'Secrets',
};

export function AchievementsPanel({ unlocked }: AchievementsPanelProps) {
  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked]);

  const grouped = useMemo(() => {
    const g: Record<AchievementCategory, Achievement[]> = { geographic: [], ambient: [], hidden: [] };
    for (const a of ACHIEVEMENTS) g[a.category].push(a);
    return g;
  }, []);

  const total = ACHIEVEMENTS.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-theme-gold" />
          <span className="text-sm font-medium text-theme-primary">Achievements</span>
        </div>
        <span className="text-xs font-mono text-theme-muted">{unlockedSet.size}/{total}</span>
      </div>

      {(Object.keys(grouped) as AchievementCategory[]).map((cat) => (
        <div key={cat}>
          <p className="text-[10px] uppercase tracking-wider text-theme-muted mb-2">{CATEGORY_LABEL[cat]}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {grouped[cat].map((a) => {
              const isUnlocked = unlockedSet.has(a.id);
              const isSecret = a.hidden && !isUnlocked;
              const Icon = isSecret ? HelpCircle : isUnlocked ? iconByName(a.icon) : Lock;
              return (
                <motion.div
                  key={a.id}
                  initial={false}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                    isUnlocked
                      ? 'bg-theme-gold-soft border-theme-gold-border'
                      : 'bg-theme-dim border-theme-border'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isUnlocked ? 'bg-theme-gold-soft text-theme-gold' : 'bg-theme-disabled-bg text-theme-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${isUnlocked ? 'text-theme-primary' : 'text-theme-muted'}`}>
                      {isSecret ? 'Hidden achievement' : a.name}
                    </p>
                    <p className="text-[10px] text-theme-muted truncate">
                      {isSecret ? 'Keep travelling to discover this.' : a.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
