import { Plane, Compass, MapPin, Navigation, Cloud, Star, Anchor, Car } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS: LucideIcon[] = [Plane, Compass, MapPin, Navigation, Cloud, Star, Anchor, Car];

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

interface PlayerAvatarProps {
  playerId: string;
  size?: number;
  className?: string;
}

export function PlayerAvatar({ playerId, size = 36, className = '' }: PlayerAvatarProps) {
  const hash = hashString(playerId);
  const Icon = ICONS[hash % ICONS.length];
  const color = COLORS[hash % COLORS.length];

  return (
    <div
      className={`rounded-lg flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}20`,
        color,
      }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}
