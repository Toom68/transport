const SUBJECT_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#a855f7', // purple
];

export function getSubjectColor(subject: string): string {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = (hash << 5) - hash + subject.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[index];
}
