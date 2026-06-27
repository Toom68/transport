interface WindshieldFrameProps {
  mode: 'dark' | 'light';
}

export function WindshieldFrame({ mode }: WindshieldFrameProps) {
  const isDark = mode === 'dark';

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
      <defs>
        <linearGradient id="driveFrameTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isDark ? '#1e293b' : '#968b76'} />
          <stop offset="100%" stopColor={isDark ? '#0f172a' : '#b8ad94'} />
        </linearGradient>
        <linearGradient id="driveFrameBottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isDark ? '#0f172a' : '#b8ad94'} />
          <stop offset="100%" stopColor={isDark ? '#1e293b' : '#968b76'} />
        </linearGradient>
        <linearGradient id="driveFrameSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={isDark ? '#1e293b' : '#968b76'} />
          <stop offset="50%" stopColor={isDark ? '#334155' : '#a89e8a'} />
          <stop offset="100%" stopColor={isDark ? '#1e293b' : '#968b76'} />
        </linearGradient>
      </defs>

      {/* Top frame — window header */}
      <rect x="0" y="0" width="100%" height="8%" fill="url(#driveFrameTop)" />
      {/* Bottom frame — door sill */}
      <rect x="0" y="92%" width="100%" height="8%" fill="url(#driveFrameBottom)" />
      {/* Left pillar */}
      <rect x="0" y="0" width="5%" height="100%" fill="url(#driveFrameSide)" />
      {/* Right pillar */}
      <rect x="95%" y="0" width="5%" height="100%" fill="url(#driveFrameSide)" />

      {/* Subtle highlight on top edge */}
      <rect x="5%" y="8%" width="90%" height="1" fill={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)'} />

      {/* Inner shadow on frame edges */}
      <rect x="5%" y="8%" width="1" height="84%" fill={isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'} />
      <rect x="94%" y="8%" width="1" height="84%" fill={isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'} />

      {/* Window reflection — subtle diagonal sheen */}
      <polygon
        points="10%,10% 30%,10% 25%,88% 5%,88%"
        fill={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)'}
      />
    </svg>
  );
}
