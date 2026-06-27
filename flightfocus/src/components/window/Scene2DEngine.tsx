import { useEffect, useRef, useMemo, useState, memo } from 'react';
import type { getSolarPosition } from '@/utils/time';
import type { WeatherCondition } from '@/types/weather';
import { cloudDensity as getCloudDensity, isRaining, isOvercast as isOvercastCondition } from '@/types/weather';
import { getBiome, type BiomeInfo } from '@/utils/biome';
import {
  PineTree,
  DeciduousTree,
  PalmTree,
  Building,
  SkylineLayer,
  Mountain,
  WaveLayer,
  Ship,
  Dune,
  FarmField,
  Coastline,
  SnowDrift,
  seededRandom,
} from './TerrainElements';

type SolarData = ReturnType<typeof getSolarPosition> | null;

interface Scene2DEngineProps {
  altitude: number;
  phase: string;
  speed: number;
  progress: number;
  solarData: SolarData;
  weatherCondition?: WeatherCondition;
  lat: number;
  lng: number;
  depLat: number;
  depLng: number;
  arrLat: number;
  arrLng: number;
}

// ---------- Sky colour keyframes (reused from old Scene2D) ----------
const SKY_KEYFRAMES: { alt: number; stops: [string, string, string, string, string] }[] = [
  { alt: 60, stops: ['#0d3b6e', '#2563a8', '#5a9fd8', '#9cc8e8', '#d0e8f5'] },
  { alt: 25, stops: ['#1a4a7a', '#3a78b0', '#7ab0d8', '#b8d8ec', '#e0f0f8'] },
  { alt: 6, stops: ['#1e3a6a', '#5a5a8a', '#e8954a', '#f5b870', '#ffd9a0'] },
  { alt: 1, stops: ['#152348', '#3a3a6a', '#c8553a', '#f07840', '#ffb060'] },
  { alt: -3, stops: ['#0a1530', '#2a2050', '#7a3548', '#c8483a', '#e8704a'] },
  { alt: -7, stops: ['#060d20', '#1a1838', '#3a2050', '#6a2a48', '#9a3a50'] },
  { alt: -12, stops: ['#040810', '#0a1024', '#161a38', '#221c40', '#2a1f48'] },
  { alt: -20, stops: ['#020408', '#050a14', '#080f1c', '#0a1020', '#0c1428'] },
];

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 0xff) + (((pb >> 16) & 0xff) - ((pa >> 16) & 0xff)) * t);
  const g = Math.round(((pa >> 8) & 0xff) + (((pb >> 8) & 0xff) - ((pa >> 8) & 0xff)) * t);
  const bl = Math.round((pa & 0xff) + ((pb & 0xff) - (pa & 0xff)) * t);
  return `rgb(${r},${g},${bl})`;
}

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
  const eased = t * t * (3 - 2 * t);
  return upper.stops.map((c, idx) => lerpHex(c, lower.stops[idx], 1 - eased));
}

// Compute a tint color + opacity for day/night/atmosphere
function getTint(sunAlt: number): { color: string; opacity: number } {
  if (sunAlt > 10) return { color: '#000000', opacity: 0 };
  if (sunAlt > 0) return { color: '#3a2a1a', opacity: 0.08 };
  if (sunAlt > -6) return { color: '#1a1a3a', opacity: 0.2 };
  if (sunAlt > -12) return { color: '#0a0a2a', opacity: 0.4 };
  return { color: '#000010', opacity: 0.6 };
}

// Altitude factor: 0 = ground, 1 = cruise altitude
function getAltitudeFactor(altitude: number): number {
  return Math.min(1, altitude / 38000);
}

// Determine which terrain layers to show based on altitude
function getLayerVisibility(altFactor: number, phase: string) {
  const isGround = phase === 'BOARDING' || phase === 'TAXI' || phase === 'ARRIVED';
  const isTakeoff = phase === 'TAKEOFF';
  const isLanding = phase === 'LANDING';

  return {
    // Far background (mountains, distant skyline) — visible at all altitudes
    farBackground: true,
    // Midground (hills, forest line, city skyline) — fades out at very high altitude
    midground: altFactor < 0.85 || isGround || isTakeoff || isLanding,
    // Foreground (trees, buildings, details) — only visible at low altitude
    foreground: altFactor < 0.15 || isGround,
    // Ground texture — visible at low altitude
    ground: altFactor < 0.3 || isGround,
    // Runway — visible on ground
    runway: isGround || isTakeoff || (isLanding && altFactor < 0.05),
  };
}

// ---------- Biome-aware terrain layer ----------
interface TerrainLayerConfig {
  biome: BiomeInfo;
  width: number;
  height: number;
  scrollOffset: number;
  altFactor: number;
  tint: string;
  tintOpacity: number;
  sunAlt: number;
  phase: string;
  layer: 'far' | 'mid' | 'near';
  seed: number;
}

const BiomeTerrainLayer = memo(function BiomeTerrainLayer({
  biome,
  width,
  height,
  scrollOffset,
  altFactor,
  tint,
  tintOpacity,
  sunAlt,
  phase,
  layer,
  seed,
}: TerrainLayerConfig) {
  if (biome.biome === 'ocean') {
    if (layer === 'far') {
      return (
        <g>
          <rect x={0} y={height * 0.5} width={width} height={height * 0.5} fill={biome.groundColor} opacity={0.7} />
          <WaveLayer y={height * 0.5} width={width} amplitude={3} wavelength={60} phase={scrollOffset * 0.5} color={biome.accentColor} opacity={0.4} />
        </g>
      );
    }
    if (layer === 'mid') {
      return (
        <g>
          <WaveLayer y={height * 0.55} width={width} amplitude={5} wavelength={80} phase={scrollOffset * 0.8} color={biome.accentColor} opacity={0.5} />
          <WaveLayer y={height * 0.62} width={width} amplitude={4} wavelength={50} phase={scrollOffset * 1.2 + 1} color={biome.groundColor} opacity={0.6} />
          {scrollOffset % 200 < 50 && (
            <Ship x={(width * 0.3 + scrollOffset * 0.3) % width} y={height * 0.58} scale={0.8} tint={tint} tintOpacity={tintOpacity} seed={seed} />
          )}
        </g>
      );
    }
    return (
      <g>
        <WaveLayer y={height * 0.7} width={width} amplitude={6} wavelength={40} phase={scrollOffset * 2} color={biome.accentColor} opacity={0.7} />
        <WaveLayer y={height * 0.78} width={width} amplitude={5} wavelength={30} phase={scrollOffset * 2.5 + 2} color={biome.groundColor} opacity={0.8} />
      </g>
    );
  }

  if (biome.biome === 'mountain') {
    if (layer === 'far') {
      const rng = seededRandom(seed);
      const peaks: number[] = [];
      for (let i = 0; i < 6; i++) peaks.push(rng());
      return (
        <g>
          {peaks.map((p, i) => (
            <Mountain
              key={i}
              x={((i * width / 5 + scrollOffset * 0.1) % (width + 100)) - 50}
              y={height * 0.55}
              scale={0.6 + p * 0.4}
              tint={tint}
              tintOpacity={tintOpacity * 0.6}
              seed={seed + i * 17}
            />
          ))}
        </g>
      );
    }
    if (layer === 'mid') {
      const rng = seededRandom(seed + 100);
      return (
        <g>
          {Array.from({ length: 4 }).map((_, i) => (
            <Mountain
              key={i}
              x={((i * width / 3 + scrollOffset * 0.3) % (width + 80)) - 40}
              y={height * 0.65}
              scale={0.4 + rng() * 0.3}
              tint={tint}
              tintOpacity={tintOpacity * 0.7}
              seed={seed + i * 23}
            />
          ))}
        </g>
      );
    }
    return null;
  }

  if (biome.biome === 'forest' || biome.biome === 'tropical') {
    const TreeComp = biome.biome === 'tropical' ? PalmTree : (sunAlt < -5 ? PineTree : DeciduousTree);
    if (layer === 'far') {
      return (
        <rect x={0} y={height * 0.52} width={width} height={height * 0.48} fill={biome.groundColor} opacity={0.5} />
      );
    }
    if (layer === 'mid') {
      const rng = seededRandom(seed + 50);
      return (
        <g>
          <rect x={0} y={height * 0.6} width={width} height={height * 0.4} fill={biome.groundColor} opacity={0.6} />
          {Array.from({ length: 12 }).map((_, i) => (
            <TreeComp
              key={i}
              x={((i * width / 10 + scrollOffset * 0.4) % (width + 40)) - 20}
              y={height * (0.62 + rng() * 0.05)}
              scale={0.5 + rng() * 0.3}
              tint={tint}
              tintOpacity={tintOpacity * 0.6}
              seed={seed + i * 13}
            />
          ))}
        </g>
      );
    }
    const rng = seededRandom(seed + 200);
    return (
      <g>
        <rect x={0} y={height * 0.75} width={width} height={height * 0.25} fill={biome.groundColor} opacity={0.8} />
        {Array.from({ length: 8 }).map((_, i) => (
          <TreeComp
            key={i}
            x={((i * width / 6 + scrollOffset * 0.8) % (width + 50)) - 25}
            y={height * (0.78 + rng() * 0.05)}
            scale={0.8 + rng() * 0.4}
            tint={tint}
            tintOpacity={tintOpacity}
            seed={seed + i * 29}
          />
        ))}
      </g>
    );
  }

  if (biome.biome === 'urban') {
    if (layer === 'far') {
      return (
        <rect x={0} y={height * 0.5} width={width} height={height * 0.5} fill={biome.groundColor} opacity={0.4} />
      );
    }
    if (layer === 'mid') {
      return (
        <g>
          <rect x={0} y={height * 0.55} width={width} height={height * 0.45} fill={biome.groundColor} opacity={0.5} />
          <SkylineLayer x={0} y={height * 0.62} width={width} scale={0.5} tint={tint} tintOpacity={tintOpacity * 0.6} seed={seed} />
        </g>
      );
    }
    return (
      <g>
        <rect x={0} y={height * 0.72} width={width} height={height * 0.28} fill={biome.groundColor} opacity={0.7} />
        <SkylineLayer x={-scrollOffset * 0.5 % 30} y={height * 0.8} width={width + 30} scale={0.9} tint={tint} tintOpacity={tintOpacity} seed={seed + 50} />
      </g>
    );
  }

  if (biome.biome === 'desert') {
    if (layer === 'far') {
      return (
        <g>
          <rect x={0} y={height * 0.55} width={width} height={height * 0.45} fill={biome.groundColor} opacity={0.5} />
          {Array.from({ length: 4 }).map((_, i) => (
            <Dune key={i} x={((i * width / 3 + scrollOffset * 0.15) % (width + 100)) - 50} y={height * 0.6} scale={0.7 + (i % 2) * 0.2} tint={tint} tintOpacity={tintOpacity * 0.5} seed={seed + i * 19} />
          ))}
        </g>
      );
    }
    if (layer === 'mid') {
      return (
        <g>
          <rect x={0} y={height * 0.65} width={width} height={height * 0.35} fill={biome.groundColor} opacity={0.7} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Dune key={i} x={((i * width / 4 + scrollOffset * 0.4) % (width + 80)) - 40} y={height * 0.7} scale={0.5 + (i % 3) * 0.15} tint={tint} tintOpacity={tintOpacity * 0.7} seed={seed + i * 31} />
          ))}
        </g>
      );
    }
    return (
      <rect x={0} y={height * 0.8} width={width} height={height * 0.2} fill={biome.groundColor} opacity={0.85} />
    );
  }

  if (biome.biome === 'farmland') {
    if (layer === 'far') {
      return <rect x={0} y={height * 0.55} width={width} height={height * 0.45} fill={biome.groundColor} opacity={0.4} />;
    }
    if (layer === 'mid') {
      const rng = seededRandom(seed + 30);
      return (
        <g>
          <rect x={0} y={height * 0.6} width={width} height={height * 0.4} fill={biome.groundColor} opacity={0.5} />
          {Array.from({ length: 4 }).map((_, i) => (
            <FarmField
              key={i}
              x={((i * width / 3 + scrollOffset * 0.3) % (width + 60)) - 30}
              y={height * 0.62}
              width={width * 0.3}
              height={height * 0.15}
              color={i % 2 === 0 ? biome.accentColor : '#9aaa6a'}
              tint={tint}
              tintOpacity={tintOpacity * 0.6}
              seed={seed + i * 37}
            />
          ))}
        </g>
      );
    }
    const rng = seededRandom(seed + 180);
    return (
      <g>
        <rect x={0} y={height * 0.75} width={width} height={height * 0.25} fill={biome.groundColor} opacity={0.8} />
        {Array.from({ length: 5 }).map((_, i) => (
          <FarmField
            key={i}
            x={((i * width / 4 + scrollOffset * 0.7) % (width + 50)) - 25}
            y={height * 0.78}
            width={width * 0.25}
            height={height * 0.12}
            color={i % 2 === 0 ? '#8aaa5a' : '#aaaa7a'}
            tint={tint}
            tintOpacity={tintOpacity}
            seed={seed + i * 41}
          />
        ))}
      </g>
    );
  }

  if (biome.biome === 'tundra') {
    if (layer === 'far') {
      return <rect x={0} y={height * 0.5} width={width} height={height * 0.5} fill={biome.groundColor} opacity={0.5} />;
    }
    if (layer === 'mid') {
      const rng = seededRandom(seed + 70);
      return (
        <g>
          <rect x={0} y={height * 0.6} width={width} height={height * 0.4} fill={biome.groundColor} opacity={0.7} />
          {Array.from({ length: 6 }).map((_, i) => (
            <SnowDrift key={i} x={((i * width / 5 + scrollOffset * 0.3) % (width + 60)) - 30} y={height * (0.65 + rng() * 0.05)} scale={0.6 + rng() * 0.3} tint={tint} tintOpacity={tintOpacity * 0.6} seed={seed + i * 43} />
          ))}
        </g>
      );
    }
    const rng = seededRandom(seed + 250);
    return (
      <g>
        <rect x={0} y={height * 0.78} width={width} height={height * 0.22} fill={biome.groundColor} opacity={0.9} />
        {Array.from({ length: 8 }).map((_, i) => (
          <SnowDrift key={i} x={((i * width / 7 + scrollOffset * 0.6) % (width + 40)) - 20} y={height * (0.82 + rng() * 0.05)} scale={0.8 + rng() * 0.4} tint={tint} tintOpacity={tintOpacity} seed={seed + i * 47} />
        ))}
      </g>
    );
  }

  if (biome.biome === 'coastal') {
    if (layer === 'far') {
      return <Coastline y={height * 0.5} width={width} waterColor="#1a4a6a" sandColor={biome.groundColor} phase={scrollOffset * 0.2} tint={tint} tintOpacity={tintOpacity * 0.5} />;
    }
    if (layer === 'mid') {
      return (
        <g>
          <WaveLayer y={height * 0.6} width={width} amplitude={4} wavelength={50} phase={scrollOffset * 0.8} color="#1a4a6a" opacity={0.5} />
          <rect x={0} y={height * 0.68} width={width} height={height * 0.32} fill={biome.groundColor} opacity={0.7} />
        </g>
      );
    }
    return <rect x={0} y={height * 0.8} width={width} height={height * 0.2} fill={biome.groundColor} opacity={0.85} />;
  }

  // Airport — tarmac, runway, terminal buildings, control tower
  if (biome.biome === 'airport') {
    if (layer === 'far') {
      return (
        <g>
          <rect x={0} y={height * 0.5} width={width} height={height * 0.5} fill={biome.groundColor} opacity={0.6} />
          {/* Distant terminal buildings */}
          {Array.from({ length: 5 }).map((_, i) => (
            <rect
              key={i}
              x={((i * width / 4 + scrollOffset * 0.15) % (width + 20)) - 10}
              y={height * 0.52}
              width={width * 0.12}
              height={height * 0.06}
              fill="#4a4a5a"
              opacity={0.5}
            />
          ))}
        </g>
      );
    }
    if (layer === 'mid') {
      return (
        <g>
          <rect x={0} y={height * 0.6} width={width} height={height * 0.4} fill={biome.groundColor} opacity={0.75} />
          {/* Terminal buildings with windows */}
          {Array.from({ length: 4 }).map((_, i) => {
            const bx = ((i * width / 3 + scrollOffset * 0.3) % (width + 30)) - 15;
            return (
              <g key={i}>
                <rect x={bx} y={height * 0.62} width={width * 0.15} height={height * 0.08} fill="#3a3a4a" opacity={0.8} />
                {/* Window strip */}
                <rect x={bx + 1} y={height * 0.64} width={width * 0.13} height={height * 0.02} fill="#ffd980" opacity={0.4} />
              </g>
            );
          })}
          {/* Control tower */}
          {(() => {
            const tx = (scrollOffset * 0.3 + width * 0.7) % (width + 20) - 10;
            return (
              <g>
                <rect x={tx} y={height * 0.58} width={2} height={height * 0.06} fill="#4a4a5a" />
                <rect x={tx - 1.5} y={height * 0.56} width={5} height={height * 0.025} fill="#5a5a6a" opacity={0.8} />
                <rect x={tx - 0.5} y={height * 0.565} width={3} height={height * 0.015} fill="#ffd980" opacity={0.5} />
              </g>
            );
          })()}
        </g>
      );
    }
    // Near layer — runway tarmac with markings
    return (
      <g>
        <rect x={0} y={height * 0.75} width={width} height={height * 0.25} fill={biome.groundColor} opacity={0.9} />
        {/* Runway surface */}
        <rect x={0} y={height * 0.82} width={width} height={height * 0.1} fill="#1a1a1e" opacity={0.95} />
        {/* Centre line dashes */}
        {Array.from({ length: 10 }).map((_, i) => {
          const dashX = ((i * 12 + scrollOffset * 0.8) % 120) - 10;
          return (
            <rect key={i} x={dashX} y={height * 0.865} width={5} height={0.8} fill="#ddd" opacity={0.7} />
          );
        })}
        {/* Edge stripes */}
        <rect x={0} y={height * 0.83} width={width} height={0.4} fill="#eee" opacity={0.4} />
        <rect x={0} y={height * 0.915} width={width} height={0.4} fill="#eee" opacity={0.4} />
        {/* Taxiway markings */}
        {Array.from({ length: 4 }).map((_, i) => {
          const tx = ((i * 25 + scrollOffset * 0.6) % (width + 15)) - 7;
          return <rect key={i} x={tx} y={height * 0.78} width={3} height={2} fill="#ffcc40" opacity={0.5} />;
        })}
      </g>
    );
  }

  // Default / wetland
  if (layer === 'far') {
    return <rect x={0} y={height * 0.55} width={width} height={height * 0.45} fill={biome.groundColor} opacity={0.5} />;
  }
  if (layer === 'mid') {
    return <rect x={0} y={height * 0.65} width={width} height={height * 0.35} fill={biome.groundColor} opacity={0.7} />;
  }
  return <rect x={0} y={height * 0.8} width={width} height={height * 0.2} fill={biome.groundColor} opacity={0.85} />;
});

// ---------- Stars ----------
interface Star { x: number; y: number; r: number; tw: number; phase: number; }

// ---------- Main component ----------
export function Scene2DEngine({
  altitude,
  phase,
  speed,
  progress,
  solarData,
  weatherCondition,
  lat,
  lng,
  depLat,
  depLng,
  arrLat,
  arrLng,
}: Scene2DEngineProps) {
  const weatherCond = weatherCondition ?? 'clear';
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);
  const scrollRef = useRef(0);
  const starsRef = useRef<Star[]>([]);
  const timeRef = useRef(0);

  const solarRef = useRef(solarData);
  const weatherRef = useRef(weatherCond);
  const altRef = useRef(altitude);
  const speedRef = useRef(speed);
  const phaseRef = useRef(phase);
  const latRef = useRef(lat);
  const lngRef = useRef(lng);
  solarRef.current = solarData;
  weatherRef.current = weatherCond;
  altRef.current = altitude;
  speedRef.current = speed;
  phaseRef.current = phase;
  latRef.current = lat;
  lngRef.current = lng;

  // Init stars
  useEffect(() => {
    if (starsRef.current.length > 0) return;
    for (let i = 0; i < 80; i++) {
      starsRef.current.push({
        x: Math.random(),
        y: Math.random() * 0.6,
        r: 0.4 + Math.random() * 1.1,
        tw: 0.4 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }, []);

  // Animation loop — updates scroll position and forces re-render via state
  const tickRef = useRef(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    let lastT = performance.now();
    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      timeRef.current += dt;
      // Scroll speed based on aircraft speed
      const scrollSpeed = speedRef.current * 0.05;
      scrollRef.current += scrollSpeed * dt;
      tickRef.current++;
      // Force re-render at ~30fps
      if (tickRef.current % 2 === 0) {
        setTick((t) => (t + 1) & 0x7fffffff);
      }
      animRef.current = requestAnimationFrame(render);
    };
    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const sunAlt = solarData?.altitude ?? -20;
  const sunAz = solarData?.azimuth ?? 180;
  const density = getCloudDensity(weatherCond);
  const overcast = isOvercastCondition(weatherCond);
  const raining = isRaining(weatherCond);
  const altFactor = getAltitudeFactor(altitude);
  const tint = getTint(sunAlt);
  const layerVis = getLayerVisibility(altFactor, phase);
  const scroll = scrollRef.current;
  const t = timeRef.current;

  // Get current biome
  const airportCoords = useMemo(
    () => [
      { lat: depLat, lng: depLng },
      { lat: arrLat, lng: arrLng },
    ],
    [depLat, depLng, arrLat, arrLng]
  );
  const biome = useMemo(() => getBiome(lat, lng, airportCoords), [lat, lng, airportCoords]);

  // Sky gradient stops
  const skyStops = getSkyStops(sunAlt);
  const skyId = 'skyGrad';

  // Sun position
  const sunY = 50 + (sunAlt / 90) * 30;
  const sunX = 25 + (sunAz / 360) * 50;
  const sunVisible = sunAlt > -8;
  const sunColor = sunAlt < 5 ? '#ffaa50' : '#fff5d0';
  const sunGlowColor = sunAlt < 5 ? '255,160,80' : '255,230,180';

  // Weather attenuation
  const weatherAttenuation = 1 - density * 0.6;
  const starOpacity = sunAlt < -2 ? Math.min(1, (-sunAlt - 2) / 10) * (1 - density * 0.8) : 0;

  // Cloud opacity
  const cloudAlpha = density * (sunAlt > -6 ? 0.55 : 0.3);
  const cloudColor = sunAlt > 10 ? `rgba(240,245,255,${cloudAlpha})` : sunAlt > -4 ? `rgba(200,180,160,${cloudAlpha})` : `rgba(60,70,90,${cloudAlpha * 0.5})`;
  const numCloudBands = overcast ? 5 : 3;

  // Runway rendering (side view)
  const showRunway = layerVis.runway;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skyStops[0]} />
          <stop offset="25%" stopColor={skyStops[1]} />
          <stop offset="50%" stopColor={skyStops[2]} />
          <stop offset="75%" stopColor={skyStops[3]} />
          <stop offset="100%" stopColor={skyStops[4]} />
        </linearGradient>
        <radialGradient id="sunGlow" cx={`${sunX}%`} cy={`${sunY}%`} r="60%">
          <stop offset="0%" stopColor={`rgba(${sunGlowColor},${0.25 * weatherAttenuation * Math.max(0, 1 - Math.abs(sunAlt) / 10)})`} />
          <stop offset="30%" stopColor={`rgba(${sunGlowColor},${0.08 * weatherAttenuation * Math.max(0, 1 - Math.abs(sunAlt) / 10)})`} />
          <stop offset="100%" stopColor={`rgba(${sunGlowColor},0)`} />
        </radialGradient>
        <clipPath id="windowClip">
          <ellipse cx="50" cy="50" rx="28" ry="42" />
        </clipPath>
      </defs>

      {/* Everything inside the window is clipped to the oval */}
      <g clipPath="url(#windowClip)">
        {/* Sky */}
        <rect x="0" y="0" width="100" height="100" fill={`url(#${skyId})`} />

        {/* Sun glow */}
        {sunVisible && sunAlt > -8 && sunAlt < 20 && (
          <rect x="0" y="0" width="100" height="100" fill="url(#sunGlow)" />
        )}

        {/* Sun disc */}
        {sunVisible && density < 0.7 && (
          <circle cx={sunX} cy={sunY} r={2.5} fill={sunColor} opacity={weatherAttenuation * 0.9} />
        )}

        {/* Moon at night */}
        {sunAlt < -4 && density < 0.5 && (
          <circle cx={75} cy={20} r={2} fill="#e0e0f0" opacity={0.6 * (1 - density)} />
        )}

        {/* Stars */}
        {starOpacity > 0.01 && (
          <g opacity={starOpacity}>
            {starsRef.current.map((star, i) => {
              const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * star.tw + star.phase));
              return (
                <circle
                  key={i}
                  cx={star.x * 100}
                  cy={star.y * 100}
                  r={star.r * 0.3}
                  fill="#fff"
                  opacity={tw * 0.8}
                />
              );
            })}
          </g>
        )}

        {/* Weather darkening */}
        {(overcast || raining) && (
          <rect x="0" y="0" width="100" height="100" fill={`rgba(40,50,65,${overcast ? 0.25 * density : 0.15})`} />
        )}

        {/* Far terrain layer (parallax slowest) */}
        {layerVis.farBackground && (
          <BiomeTerrainLayer
            biome={biome}
            width={100}
            height={100}
            scrollOffset={scroll * 0.1}
            altFactor={altFactor}
            tint={tint.color}
            tintOpacity={tint.opacity * 0.5}
            sunAlt={sunAlt}
            phase={phase}
            layer="far"
            seed={Math.floor(lat * 1000 + lng)}
          />
        )}

        {/* Midground terrain layer */}
        {layerVis.midground && (
          <BiomeTerrainLayer
            biome={biome}
            width={100}
            height={100}
            scrollOffset={scroll * 0.3}
            altFactor={altFactor}
            tint={tint.color}
            tintOpacity={tint.opacity * 0.7}
            sunAlt={sunAlt}
            phase={phase}
            layer="mid"
            seed={Math.floor(lat * 1000 + lng) + 100}
          />
        )}

        {/* Foreground terrain layer (fastest parallax) */}
        {layerVis.foreground && (
          <BiomeTerrainLayer
            biome={biome}
            width={100}
            height={100}
            scrollOffset={scroll * 0.6}
            altFactor={altFactor}
            tint={tint.color}
            tintOpacity={tint.opacity}
            sunAlt={sunAlt}
            phase={phase}
            layer="near"
            seed={Math.floor(lat * 1000 + lng) + 200}
          />
        )}

        {/* Runway (side view — visible on ground) */}
        {showRunway && (
          <g>
            <rect x="0" y="82" width="100" height="18" fill="#2a2a2a" opacity={0.9} />
            {/* Runway markings — dashed centre line scrolling right to left */}
            {Array.from({ length: 10 }).map((_, i) => {
              const dashX = ((i * 12 + scroll * 0.8) % 120) - 10;
              return (
                <rect
                  key={i}
                  x={dashX}
                  y="89"
                  width="5"
                  height="0.8"
                  fill="#ddd"
                  opacity="0.7"
                />
              );
            })}
            {/* Edge stripes */}
            <rect x="0" y="84" width="100" height="0.5" fill="#eee" opacity="0.5" />
            <rect x="0" y="95" width="100" height="0.5" fill="#eee" opacity="0.5" />
          </g>
        )}

        {/* Cloud overlay */}
        {density > 0.1 && (
          <g>
            {Array.from({ length: numCloudBands }).map((_, b) => {
              const yBase = 15 + b * 12;
              return Array.from({ length: 6 }).map((_, i) => {
                const cx = ((i * 25 + scroll * (0.5 + b * 0.2) + t * (3 + b)) % 140) - 20;
                const cy = yBase + Math.sin(t * 0.3 + i * 1.7 + b) * 2;
                const cr = 8 + Math.sin(i * 2.3 + b) * 3;
                return (
                  <ellipse
                    key={`${b}-${i}`}
                    cx={cx}
                    cy={cy}
                    rx={cr}
                    ry={cr * 0.4}
                    fill={cloudColor}
                  />
                );
              });
            })}
          </g>
        )}

        {/* Atmospheric haze at horizon for high altitude */}
        {altFactor > 0.3 && (
          <rect
            x="0"
            y={45 + altFactor * 10}
            width="100"
            height={15}
            fill={skyStops[3]}
            opacity={altFactor * 0.3}
          />
        )}
      </g>
    </svg>
  );
}
