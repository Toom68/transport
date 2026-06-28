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
          <stop offset="40%" stopColor={isDark ? '#1a2332' : '#a89e8a'} />
          <stop offset="100%" stopColor={isDark ? '#252e3f' : '#8a8070'} />
        </linearGradient>
        <linearGradient id="driveFrameSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={isDark ? '#1e293b' : '#968b76'} />
          <stop offset="50%" stopColor={isDark ? '#334155' : '#a89e8a'} />
          <stop offset="100%" stopColor={isDark ? '#1e293b' : '#968b76'} />
        </linearGradient>
        <radialGradient id="driveVignette" cx="0.5" cy="0.5" r="0.7">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor={isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)'} />
        </radialGradient>
      </defs>

      {/* Top frame — window header with rounded bottom edge */}
      <path
        d="M 0 0 L 100% 0 L 100% 7% Q 100% 9% 98% 9% L 2% 9% Q 0 9% 0 7% Z"
        fill="url(#driveFrameTop)"
      />

      {/* Bottom frame — dashboard sill with rounded top edge */}
      <path
        d="M 0 100% L 100% 100% L 100% 93% Q 100% 91% 98% 91% L 2% 91% Q 0 91% 0 93% Z"
        fill="url(#driveFrameBottom)"
      />

      {/* Dashboard highlight strip */}
      <rect x="2%" y="91.5%" width="96%" height="0.5" fill={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.2)'} />

      {/* Left pillar */}
      <rect x="0" y="0" width="5%" height="100%" fill="url(#driveFrameSide)" />
      {/* Right pillar */}
      <rect x="95%" y="0" width="5%" height="100%" fill="url(#driveFrameSide)" />

      {/* Subtle highlight on top edge */}
      <rect x="5%" y="9%" width="90%" height="1" fill={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)'} />

      {/* Inner shadow on frame edges */}
      <rect x="5%" y="9%" width="1" height="82%" fill={isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'} />
      <rect x="94%" y="9%" width="1" height="82%" fill={isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'} />

      {/* Rearview mirror silhouette at top center */}
      <rect x="42%" y="9%" width="16%" height="3%" rx="1" fill={isDark ? '#1a2332' : '#7a7060'} />
      <rect x="46%" y="8.5%" width="8%" height="1%" rx="0.5" fill={isDark ? '#0f172a' : '#6a6050'} />
      <rect x="44%" y="11.5%" width="12%" height="0.5" fill={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)'} />

      {/* Window reflection — subtle diagonal sheen */}
      <polygon
        points="10%,10% 30%,10% 25%,88% 5%,88%"
        fill={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)'}
      />

      {/* Edge vignette for depth */}
      <rect x="0" y="0" width="100%" height="100%" fill="url(#driveVignette)" />
    </svg>
  );
}
