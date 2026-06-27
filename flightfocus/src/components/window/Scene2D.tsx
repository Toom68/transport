import { useEffect, useRef } from 'react';
import type { getSolarPosition } from '@/utils/time';
import type { WeatherCondition } from '@/types/weather';
import { cloudDensity as getCloudDensity, isRaining, isOvercast as isOvercastCondition } from '@/types/weather';

type SolarData = ReturnType<typeof getSolarPosition> | null;

interface Scene2DProps {
  altitude: number;
  phase: string;
  speed: number;
  progress: number;
  solarData: SolarData;
  weatherCondition?: WeatherCondition;
}

// 5-stop sky colour keyframes indexed by sun altitude (degrees).
// Each entry: [top, upperMid, mid, lowerMid, bottom]
const SKY_KEYFRAMES: { alt: number; stops: [string, string, string, string, string] }[] = [
  {
    // High noon — deep blue above, bright at horizon
    alt: 60,
    stops: ['#0d3b6e', '#2563a8', '#5a9fd8', '#9cc8e8', '#d0e8f5'],
  },
  {
    // Afternoon — slightly warmer
    alt: 25,
    stops: ['#1a4a7a', '#3a78b0', '#7ab0d8', '#b8d8ec', '#e0f0f8'],
  },
  {
    // Golden hour — warm amber glow
    alt: 6,
    stops: ['#1e3a6a', '#5a5a8a', '#e8954a', '#f5b870', '#ffd9a0'],
  },
  {
    // Sun at horizon — rich sunset
    alt: 1,
    stops: ['#152348', '#3a3a6a', '#c8553a', '#f07840', '#ffb060'],
  },
  {
    // Just below horizon — deep sunset into twilight
    alt: -3,
    stops: ['#0a1530', '#2a2050', '#7a3548', '#c8483a', '#e8704a'],
  },
  {
    // Civil twilight — purple/magenta fading
    alt: -7,
    stops: ['#060d20', '#1a1838', '#3a2050', '#6a2a48', '#9a3a50'],
  },
  {
    // Nautical twilight — deep blue/purple
    alt: -12,
    stops: ['#040810', '#0a1024', '#161a38', '#221c40', '#2a1f48'],
  },
  {
    // Night — near black with faint blue
    alt: -20,
    stops: ['#020408', '#050a14', '#080f1c', '#0a1020', '#0c1428'],
  },
];

// Interpolate between two hex colours.
function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 0xff) + (((pb >> 16) & 0xff) - ((pa >> 16) & 0xff)) * t);
  const g = Math.round(((pa >> 8) & 0xff) + (((pb >> 8) & 0xff) - ((pa >> 8) & 0xff)) * t);
  const bl = Math.round((pa & 0xff) + ((pb & 0xff) - (pa & 0xff)) * t);
  return `rgb(${r},${g},${bl})`;
}

// Smooth interpolation between keyframes.
function getSkyStops(sunAlt: number): string[] {
  const kf = SKY_KEYFRAMES;
  if (sunAlt >= kf[0].alt) return kf[0].stops;
  if (sunAlt <= kf[kf.length - 1].alt) return kf[kf.length - 1].stops;

  let i = 0;
  while (i < kf.length - 1 && kf[i].alt > sunAlt) i++;

  const upper = kf[i - 1] ?? kf[0];
  const lower = kf[i];
  const range = upper.alt - lower.alt;
  const t = range > 0 ? (sunAlt - lower.alt) / range : 0;
  const eased = t * t * (3 - 2 * t); // smoothstep

  return upper.stops.map((c, idx) => lerpHex(c, lower.stops[idx], 1 - eased));
}

interface Star {
  x: number;
  y: number;
  r: number;
  tw: number;
  phase: number;
}

export function Scene2D({ solarData, weatherCondition }: Scene2DProps) {
  const weatherCond = weatherCondition ?? 'clear';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);
  const timeRef = useRef(0);
  const solarRef = useRef(solarData);
  const weatherRef = useRef(weatherCond);
  solarRef.current = solarData;
  weatherRef.current = weatherCond;

  // Init stars once.
  useEffect(() => {
    if (starsRef.current.length > 0) return;
    for (let i = 0; i < 80; i++) {
      starsRef.current.push({
        x: Math.random(),
        y: Math.random() * 0.7,
        r: 0.4 + Math.random() * 1.1,
        tw: 0.4 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let lastT = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      timeRef.current += dt;
      const t = timeRef.current;

      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;

      const sunAlt = solarRef.current?.altitude ?? -20;
      const wCond = weatherRef.current;
      const density = getCloudDensity(wCond);
      const overcast = isOvercastCondition(wCond);
      const raining = isRaining(wCond);

      // --- Sky gradient (5 stops) ---
      const stops = getSkyStops(sunAlt);
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, stops[0]);
      grad.addColorStop(0.25, stops[1]);
      grad.addColorStop(0.5, stops[2]);
      grad.addColorStop(0.75, stops[3]);
      grad.addColorStop(1, stops[4]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // --- Weather darkening overlay ---
      if (overcast || raining) {
        const darkenAlpha = overcast ? 0.25 * density : 0.15;
        ctx.fillStyle = `rgba(40, 50, 65, ${darkenAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }

      // --- Subtle sun glow at golden hour (attenuated by clouds) ---
      if (sunAlt > -8 && sunAlt < 20) {
        const glowStrength = Math.max(0, 1 - Math.abs(sunAlt) / 10);
        const weatherAttenuation = 1 - density * 0.6;
        if (glowStrength > 0.01) {
          const sunY = H * (0.55 + (sunAlt / 90) * 0.3);
          const sunX = W * (0.25 + ((solarRef.current?.azimuth ?? 180) / 360) * 0.5);
          const glowR = W * 0.6;
          const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowR);
          const isWarm = sunAlt < 10;
          const glowColor = isWarm ? '255,160,80' : '255,230,180';
          glow.addColorStop(0, `rgba(${glowColor},${0.25 * glowStrength * weatherAttenuation})`);
          glow.addColorStop(0.3, `rgba(${glowColor},${0.08 * glowStrength * weatherAttenuation})`);
          glow.addColorStop(1, `rgba(${glowColor},0)`);
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, W, H);
        }
      }

      // --- Stars at night (hidden by cloud cover) ---
      if (sunAlt < -2) {
        const starOpacity = Math.min(1, (-sunAlt - 2) / 10) * (1 - density * 0.8);
        if (starOpacity > 0.01) {
          for (const star of starsRef.current) {
            const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * star.tw + star.phase));
            ctx.fillStyle = `rgba(255,255,255,${tw * starOpacity * 0.8})`;
            ctx.beginPath();
            ctx.arc(star.x * W, star.y * H, star.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // --- Procedural cloud layer ---
      if (density > 0.1) {
        const cloudAlpha = density * (sunAlt > -6 ? 0.6 : 0.3);
        const cloudColor = sunAlt > 10
          ? `rgba(240, 245, 255, ${cloudAlpha})`
          : sunAlt > -4
          ? `rgba(200, 180, 160, ${cloudAlpha})`
          : `rgba(60, 70, 90, ${cloudAlpha * 0.5})`;

        const numBands = overcast ? 5 : 3;
        for (let b = 0; b < numBands; b++) {
          const yBase = H * (0.15 + b * 0.18);
          const drift = (t * (5 + b * 3)) % (W * 2);
          for (let i = 0; i < 6; i++) {
            const cx = ((i * W * 0.25 + drift) % (W * 1.4)) - W * 0.2;
            const cy = yBase + Math.sin(t * 0.3 + i * 1.7 + b) * 8;
            const cr = W * (0.12 + Math.sin(i * 2.3 + b) * 0.04);
            const cgrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
            cgrad.addColorStop(0, cloudColor);
            cgrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = cgrad;
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
