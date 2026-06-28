import { useEffect, useRef, useState } from 'react';
import type { JourneyPhase } from '@/types/journey';

type SolarData = { altitude: number; azimuth: number; isDaytime: boolean } | null;

interface DriveSceneProps {
  speed: number;
  progress: number;
  phase: JourneyPhase;
  solarData: SolarData;
}

function getSkyColors(sunAlt: number): { sky: string; horizon: string; ground: string } {
  if (sunAlt > 15) {
    return { sky: '#88aacd', horizon: '#c8d8e8', ground: '#7a8a6a' };
  }
  if (sunAlt > 0) {
    const t = sunAlt / 15;
    return {
      sky: lerpHex('#e8954a', '#88aacd', t),
      horizon: lerpHex('#ffd9a0', '#c8d8e8', t),
      ground: lerpHex('#8a7a5a', '#7a8a6a', t),
    };
  }
  if (sunAlt > -6) {
    const t = (sunAlt + 6) / 6;
    return {
      sky: lerpHex('#3a2a4a', '#e8954a', t),
      horizon: lerpHex('#7a3548', '#ffd9a0', t),
      ground: lerpHex('#4a3a3a', '#8a7a5a', t),
    };
  }
  return { sky: '#0a0a1a', horizon: '#1a1a2a', ground: '#2a2a2a' };
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

export function DriveScene({ speed, progress, phase, solarData }: DriveSceneProps) {
  const sunAlt = solarData?.altitude ?? 0;
  const colors = getSkyColors(sunAlt);
  const isMoving = phase === 'DRIVING' || phase === 'DEPARTING' || phase === 'ARRIVING';
  const isLowSun = sunAlt > -6 && sunAlt < 15;

  // Scroll offset for road animation — accumulates based on speed
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

  // Road perspective parameters
  const horizonY = 45; // % from top
  const roadVanishingX = 50; // % from left
  const dashSpacing = 40; // px between dashes
  const dashOffset = scroll % dashSpacing;

  // Speed-based sway: subtle horizontal shift at high speed
  const swayAmount = Math.min(2, speed / 80);
  const sway = isMoving ? Math.sin(scroll * 0.02) * swayAmount : 0;
  const roadCenter = roadVanishingX + sway;

  // Roadside poles: spaced every 200px, scroll with road
  const poleSpacing = 200;
  const poleOffset = scroll % poleSpacing;
  const poleCount = 6;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
      <defs>
        <linearGradient id="driveSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.sky} />
          <stop offset="100%" stopColor={colors.horizon} />
        </linearGradient>
        <linearGradient id="driveGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.horizon} />
          <stop offset="30%" stopColor={colors.ground} />
          <stop offset="100%" stopColor={colors.ground} />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width="100%" height={`${horizonY}%`} fill="url(#driveSky)" />

      {/* Sun disc near horizon during sunrise/sunset */}
      {isLowSun && sunAlt > 0 && (
        <circle
          cx={`${roadCenter + 15}%`}
          cy={`${horizonY - sunAlt * 0.5}%`}
          r="3%"
          fill="#ffd9a0"
          opacity="0.6"
        />
      )}

      {/* Ground */}
      <rect x="0" y={`${horizonY}%`} width="100%" height={`${100 - horizonY}%`} fill="url(#driveGround)" />

      {/* Distant hills on horizon */}
      <path
        d={`M 0 ${horizonY}% L 10% ${horizonY - 3}% L 20% ${horizonY - 1}% L 35% ${horizonY - 4}% L 50% ${horizonY - 2}% L 65% ${horizonY - 5}% L 80% ${horizonY - 2}% L 90% ${horizonY - 3}% L 100% ${horizonY}% Z`}
        fill={colors.ground}
        opacity="0.5"
      />

      {/* Roadside poles — left side */}
      {isMoving && Array.from({ length: poleCount }).map((_, i) => {
        const t = (i * poleSpacing + poleOffset) / 1200;
        if (t < 0 || t > 1) return null;
        const y = horizonY + t * (100 - horizonY);
        const xLeft = roadCenter - 8 - t * 20;
        const poleHeight = 3 + t * 15;
        return (
          <rect
            key={`pole-l-${i}`}
            x={`${xLeft}%`}
            y={`${y - poleHeight}%`}
            width={`${0.5 + t * 1}%`}
            height={`${poleHeight}%`}
            fill="#2a2a2a"
            opacity={0.3 + t * 0.4}
          />
        );
      })}

      {/* Roadside poles — right side */}
      {isMoving && Array.from({ length: poleCount }).map((_, i) => {
        const t = (i * poleSpacing + poleOffset) / 1200;
        if (t < 0 || t > 1) return null;
        const y = horizonY + t * (100 - horizonY);
        const xRight = roadCenter + 8 + t * 20;
        const poleHeight = 3 + t * 15;
        return (
          <rect
            key={`pole-r-${i}`}
            x={`${xRight}%`}
            y={`${y - poleHeight}%`}
            width={`${0.5 + t * 1}%`}
            height={`${poleHeight}%`}
            fill="#2a2a2a"
            opacity={0.3 + t * 0.4}
          />
        );
      })}

      {/* Road — trapezoid from vanishing point to bottom */}
      <polygon
        points={`${roadCenter - 2},${horizonY} ${roadCenter + 2},${horizonY} ${roadCenter + 15}%,100% ${roadCenter - 15}%,100%`}
        fill="#3a3a3a"
      />

      {/* Road edges — white lines */}
      <line
        x1={`${roadCenter - 2}%`} y1={`${horizonY}%`}
        x2={`${roadCenter - 15}%`} y2="100%"
        stroke="#ddd" strokeWidth="1.5" opacity="0.7"
      />
      <line
        x1={`${roadCenter + 2}%`} y1={`${horizonY}%`}
        x2={`${roadCenter + 15}%`} y2="100%"
        stroke="#ddd" strokeWidth="1.5" opacity="0.7"
      />

      {/* Center dashed line — animated */}
      {isMoving && Array.from({ length: 20 }).map((_, i) => {
        const t = (i * dashSpacing + dashOffset) / 800;
        if (t < 0 || t > 1) return null;
        // Perspective: dashes get smaller and closer to center as they approach horizon
        const y = horizonY + t * (100 - horizonY);
        const xCenter = roadCenter;
        const width = 1 + t * 8;
        const dashLen = 2 + t * 12;
        return (
          <rect
            key={i}
            x={`${xCenter - width / 2}%`}
            y={`${y}%`}
            width={`${width}%`}
            height={`${dashLen}%`}
            fill="#fff" opacity={0.4 + t * 0.4}
          />
        );
      })}

      {/* Static center line when not moving */}
      {!isMoving && (
        <line
          x1={`${roadCenter}%`} y1={`${horizonY}%`}
          x2={`${roadCenter}%`} y2="100%"
          stroke="#fff" strokeWidth="1" strokeDasharray="8,8" opacity="0.3"
        />
      )}
    </svg>
  );
}
