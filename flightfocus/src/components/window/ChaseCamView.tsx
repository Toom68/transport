import { useEffect, useRef, useState } from 'react';
import type { JourneyPhase } from '@/types/journey';

type SolarData = { altitude: number; azimuth: number; isDaytime: boolean } | null;

interface ChaseCamViewProps {
  speed: number;
  heading: number;
  solarData: SolarData;
  phase: JourneyPhase;
}

function getSkyColors(sunAlt: number): { sky: string; horizon: string; road: string } {
  if (sunAlt > 15) {
    return { sky: '#88aacd', horizon: '#c8d8e8', road: '#3a3a3a' };
  }
  if (sunAlt > 0) {
    const t = sunAlt / 15;
    return {
      sky: lerpHex('#e8954a', '#88aacd', t),
      horizon: lerpHex('#ffd9a0', '#c8d8e8', t),
      road: '#3a3a3a',
    };
  }
  if (sunAlt > -6) {
    const t = (sunAlt + 6) / 6;
    return {
      sky: lerpHex('#3a2a4a', '#e8954a', t),
      horizon: lerpHex('#7a3548', '#ffd9a0', t),
      road: '#2a2a2a',
    };
  }
  return { sky: '#0a0a1a', horizon: '#1a1a2a', road: '#222' };
}

function lerpHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

export function ChaseCamView({ speed, heading, solarData, phase }: ChaseCamViewProps) {
  const sunAlt = solarData?.altitude ?? 0;
  const colors = getSkyColors(sunAlt);
  const isMoving = phase === 'DRIVING' || phase === 'DEPARTING' || phase === 'ARRIVING';

  const scrollRef = useRef(0);
  const [scroll, setScroll] = useState(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const animate = (time: number) => {
      const dt = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = time;
      if (isMoving) {
        scrollRef.current += speed * dt * 0.5;
      }
      setScroll(scrollRef.current);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [speed, isMoving]);

  const horizonY = 35;
  const dashOffset = scroll % 50;

  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chaseSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.sky} />
          <stop offset="100%" stopColor={colors.horizon} />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width="100%" height={`${horizonY}%`} fill="url(#chaseSky)" />

      {/* Ground */}
      <rect x="0" y={`${horizonY}%`} width="100%" height={`${100 - horizonY}%`} fill={colors.horizon} opacity="0.3" />

      {/* Road — wider perspective from chase cam (behind car) */}
      <polygon
        points="40%,35% 60%,35% 85%,100% 15%,100%"
        fill={colors.road}
      />

      {/* Road edges */}
      <line x1="40%" y1="35%" x2="15%" y2="100%" stroke="#ddd" strokeWidth="2" opacity="0.6" />
      <line x1="60%" y1="35%" x2="85%" y2="100%" stroke="#ddd" strokeWidth="2" opacity="0.6" />

      {/* Center dashes — animated, perspective from behind */}
      {Array.from({ length: 15 }).map((_, i) => {
        const t = (i * 50 + dashOffset) / 750;
        if (t < 0 || t > 1) return null;
        const y = horizonY + t * (100 - horizonY);
        const width = 1 + t * 6;
        const dashLen = 3 + t * 15;
        return (
          <rect
            key={i}
            x={`${50 - width / 2}%`}
            y={`${y}%`}
            width={`${width}%`}
            height={`${dashLen}%`}
            fill="#fff" opacity={0.3 + t * 0.5}
          />
        );
      })}

      {/* Car silhouette at bottom center */}
      <g transform="translate(42%, 82%)">
        {/* Car body */}
        <rect x="0" y="3" width="16%" height="6%" rx="2" fill="#2a3a4a" />
        {/* Roof */}
        <rect x="3%" y="0" width="10%" height="4%" rx="1.5" fill="#1e2e3e" />
        {/* Windows */}
        <rect x="4%" y="0.5%" width="3.5%" height="3%" rx="1" fill="#5a7a9a" opacity="0.6" />
        <rect x="8.5%" y="0.5%" width="3.5%" height="3%" rx="1" fill="#5a7a9a" opacity="0.6" />
        {/* Wheels */}
        <circle cx="2.5%" cy="9%" r="1.5%" fill="#111" />
        <circle cx="13.5%" cy="9%" r="1.5%" fill="#111" />
        {/* Tail lights */}
        <rect x="0.5%" y="6%" width="1.5%" height="1.5%" rx="0.5" fill="#ff4444" opacity="0.8" />
        <rect x="14%" y="6%" width="1.5%" height="1.5%" rx="0.5" fill="#ff4444" opacity="0.8" />
      </g>
    </svg>
  );
}
