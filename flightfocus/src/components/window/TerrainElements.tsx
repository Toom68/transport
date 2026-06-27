import { memo } from 'react';

// SVG-based terrain elements for the 2D scene engine.
// Each element is a self-contained SVG group that can be positioned and tinted.

interface ElementProps {
  x: number;
  y: number;
  scale: number;
  tint: string; // day/night tint overlay color
  tintOpacity: number;
  seed: number;
}

// ---------- Trees ----------

export const PineTree = memo(function PineTree({ x, y, scale, tint, tintOpacity, seed }: ElementProps) {
  const h = 40 * scale;
  const w = 16 * scale;
  const sway = Math.sin(seed * 7.3) * 2 * scale;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-w * 0.08} y={0} width={w * 0.16} height={h * 0.2} fill="#3a2a1a" />
      <path
        d={`M ${-w / 2 + sway},${0} L ${sway},${-h * 0.5} L ${w / 2 + sway},${0} Z`}
        fill="#1a4a2a"
        opacity={0.9}
      />
      <path
        d={`M ${-w * 0.4 + sway},${-h * 0.2} L ${sway},${-h * 0.7} L ${w * 0.4 + sway},${-h * 0.2} Z`}
        fill="#2a5a3a"
        opacity={0.9}
      />
      <path
        d={`M ${-w * 0.3 + sway},${-h * 0.4} L ${sway},${-h * 0.9} L ${w * 0.3 + sway},${-h * 0.4} Z`}
        fill="#3a6a4a"
        opacity={0.9}
      />
      <rect x={-w / 2} y={-h} width={w} height={h} fill={tint} opacity={tintOpacity} />
    </g>
  );
});

export const DeciduousTree = memo(function DeciduousTree({ x, y, scale, tint, tintOpacity, seed }: ElementProps) {
  const h = 36 * scale;
  const w = 28 * scale;
  const r = w * 0.5;
  const offset = Math.sin(seed * 5.1) * 3 * scale;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-w * 0.06} y={-h * 0.15} width={w * 0.12} height={h * 0.25} fill="#4a3a2a" />
      <circle cx={offset} cy={-h * 0.5} r={r} fill="#3a6a3a" opacity={0.85} />
      <circle cx={offset - r * 0.4} cy={-h * 0.4} r={r * 0.7} fill="#4a7a4a" opacity={0.8} />
      <circle cx={offset + r * 0.4} cy={-h * 0.55} r={r * 0.65} fill="#2a5a2a" opacity={0.85} />
      <circle cx={offset} cy={-h * 0.65} r={r * 0.6} fill="#5a8a5a" opacity={0.7} />
      <rect x={-w} y={-h} width={w * 2} height={h} fill={tint} opacity={tintOpacity} />
    </g>
  );
});

export const PalmTree = memo(function PalmTree({ x, y, scale, tint, tintOpacity, seed }: ElementProps) {
  const h = 50 * scale;
  const w = 30 * scale;
  const bend = Math.sin(seed * 3.7) * 5 * scale;
  return (
    <g transform={`translate(${x},${y})`}>
      <path
        d={`M 0,0 Q ${bend * 0.5},${-h * 0.5} ${bend},${-h * 0.8}`}
        stroke="#5a4a2a"
        strokeWidth={w * 0.08}
        fill="none"
      />
      {[-2, -1, 0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M ${bend},${-h * 0.8} Q ${bend + i * w * 0.4},${-h * 0.9} ${bend + i * w * 0.6},${-h * 0.7}`}
          stroke="#2a6a3a"
          strokeWidth={w * 0.06}
          fill="none"
          opacity={0.85}
        />
      ))}
      <rect x={-w} y={-h} width={w * 2} height={h} fill={tint} opacity={tintOpacity} />
    </g>
  );
});

// ---------- Buildings ----------

export const Building = memo(function Building({ x, y, scale, tint, tintOpacity, seed }: ElementProps) {
  const h = (30 + Math.abs(Math.sin(seed * 2.1)) * 60) * scale;
  const w = (12 + Math.abs(Math.cos(seed * 3.7)) * 10) * scale;
  const windows = Math.floor(h / (8 * scale));
  const windowLit = seed % 3 < 2;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-w / 2} y={-h} width={w} height={h} fill="#3a3a4a" opacity={0.9} />
      <rect x={-w / 2} y={-h} width={w * 0.15} height={h} fill="#2a2a3a" opacity={0.6} />
      {Array.from({ length: windows }).map((_, i) => (
        <rect
          key={i}
          x={-w * 0.3}
          y={-h + 4 * scale + i * 8 * scale}
          width={w * 0.2}
          height={4 * scale}
          fill={windowLit && (seed + i) % 4 < 2 ? '#ffd980' : '#1a1a2a'}
          opacity={0.7}
        />
      ))}
      <rect x={-w / 2} y={-h} width={w} height={h} fill={tint} opacity={tintOpacity} />
    </g>
  );
});

export const SkylineLayer = memo(function SkylineLayer({
  x,
  y,
  width,
  scale,
  tint,
  tintOpacity,
  seed,
}: {
  x: number;
  y: number;
  width: number;
  scale: number;
  tint: string;
  tintOpacity: number;
  seed: number;
}) {
  const buildings: number[] = [];
  let cx = 0;
  let s = seed;
  while (cx < width) {
    const bw = (12 + Math.abs(Math.cos(s * 3.7)) * 10) * scale;
    buildings.push(s);
    cx += bw + 2 * scale;
    s += 1;
  }
  return (
    <g transform={`translate(${x},${y})`}>
      {buildings.map((bSeed, i) => {
        const bw = (12 + Math.abs(Math.cos(bSeed * 3.7)) * 10) * scale;
        const bx = buildings.slice(0, i).reduce((acc, prev) => {
          const pw = (12 + Math.abs(Math.cos(prev * 3.7)) * 10) * scale;
          return acc + pw + 2 * scale;
        }, 0);
        return (
          <Building
            key={i}
            x={bx + bw / 2}
            y={0}
            scale={scale}
            tint={tint}
            tintOpacity={tintOpacity}
            seed={bSeed}
          />
        );
      })}
    </g>
  );
});

// ---------- Mountains ----------

export const Mountain = memo(function Mountain({ x, y, scale, tint, tintOpacity, seed }: ElementProps) {
  const h = (60 + Math.abs(Math.sin(seed * 1.7)) * 50) * scale;
  const w = (80 + Math.abs(Math.cos(seed * 2.3)) * 40) * scale;
  const snowLine = h * (0.3 + Math.abs(Math.sin(seed * 5.1)) * 0.2);
  return (
    <g transform={`translate(${x},${y})`}>
      <path d={`M ${-w / 2},0 L 0,${-h} L ${w / 2},0 Z`} fill="#5a5a6a" opacity={0.85} />
      <path d={`M ${-w * 0.35},0 L 0,${-h} L ${w * 0.35},0 Z`} fill="#6a6a7a" opacity={0.7} />
      {/* Snow cap */}
      <path
        d={`M ${-w * 0.15},${-h + snowLine * 0.5} L 0,${-h} L ${w * 0.15},${-h + snowLine * 0.5} L ${w * 0.08},${-h + snowLine * 0.7} L ${-w * 0.08},${-h + snowLine * 0.7} Z`}
        fill="#e0e8f0"
        opacity={0.8}
      />
      <rect x={-w / 2} y={-h} width={w} height={h} fill={tint} opacity={tintOpacity} />
    </g>
  );
});

// ---------- Ocean ----------

export const WaveLayer = memo(function WaveLayer({
  y,
  width,
  amplitude,
  wavelength,
  phase,
  color,
  opacity,
}: {
  y: number;
  width: number;
  amplitude: number;
  wavelength: number;
  phase: number;
  color: string;
  opacity: number;
}) {
  const segments = Math.ceil(width / wavelength) * 2;
  let path = `M 0,${y}`;
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width;
    const wy = y + Math.sin((i / segments) * Math.PI * 2 * (width / wavelength) + phase) * amplitude;
    path += ` L ${x},${wy}`;
  }
  path += ` L ${width},${y + amplitude * 4} L 0,${y + amplitude * 4} Z`;
  return <path d={path} fill={color} opacity={opacity} />;
});

export const Ship = memo(function Ship({ x, y, scale, tint, tintOpacity }: ElementProps) {
  const w = 20 * scale;
  const h = 8 * scale;
  return (
    <g transform={`translate(${x},${y})`}>
      <path d={`M ${-w / 2},0 L ${w / 2},0 L ${w * 0.35},${h} L ${-w * 0.35},${h} Z`} fill="#3a3a4a" />
      <rect x={-w * 0.05} y={-h * 1.5} width={w * 0.1} height={h * 1.5} fill="#4a4a5a" />
      <rect x={-w * 0.3} y={-h * 0.8} width={w * 0.15} height={h * 0.4} fill="#5a5a6a" opacity={0.6} />
      <rect x={-w / 2} y={-h * 2} width={w} height={h * 3} fill={tint} opacity={tintOpacity} />
    </g>
  );
});

// ---------- Desert Dunes ----------

export const Dune = memo(function Dune({ x, y, scale, tint, tintOpacity, seed }: ElementProps) {
  const h = (20 + Math.abs(Math.sin(seed * 1.9)) * 15) * scale;
  const w = (100 + Math.abs(Math.cos(seed * 2.7)) * 60) * scale;
  const curve = Math.sin(seed * 4.1) * 0.3;
  return (
    <g transform={`translate(${x},${y})`}>
      <path
        d={`M ${-w / 2},0 Q ${-w * 0.15},${-h * (0.7 + curve)} ${w * 0.1},${-h} Q ${w * 0.3},${-h * 0.5} ${w / 2},0 Z`}
        fill="#c4a060"
        opacity={0.8}
      />
      <path
        d={`M ${-w * 0.3},0 Q ${0},${-h * 0.6} ${w * 0.2},0`}
        stroke="#d4b070"
        strokeWidth={1.5}
        fill="none"
        opacity={0.4}
      />
      <rect x={-w / 2} y={-h} width={w} height={h} fill={tint} opacity={tintOpacity} />
    </g>
  );
});

// ---------- Farmland ----------

export const FarmField = memo(function FarmField({
  x,
  y,
  width,
  height,
  color,
  tint,
  tintOpacity,
  seed,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  tint: string;
  tintOpacity: number;
  seed: number;
}) {
  const rows = Math.floor(height / (4 * (1 + (seed % 3))));
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={width} height={height} fill={color} opacity={0.75} />
      {Array.from({ length: rows }).map((_, i) => (
        <line
          key={i}
          x1={0}
          y1={(i / rows) * height}
          x2={width}
          y2={(i / rows) * height + 2}
          stroke="#000"
          strokeWidth={0.5}
          opacity={0.15}
        />
      ))}
      <rect x={0} y={0} width={width} height={height} fill={tint} opacity={tintOpacity} />
    </g>
  );
});

// ---------- Coastline ----------

export const Coastline = memo(function Coastline({
  y,
  width,
  waterColor,
  sandColor,
  phase,
  tint,
  tintOpacity,
}: {
  y: number;
  width: number;
  waterColor: string;
  sandColor: string;
  phase: number;
  tint: string;
  tintOpacity: number;
}) {
  const segments = 20;
  let beachPath = `M 0,${y + 20}`;
  let waterPath = `M 0,${y + 20}`;
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width;
    const wave = Math.sin(i * 0.8 + phase) * 8;
    const by = y + wave;
    beachPath += ` L ${x},${by}`;
    if (i === 0) waterPath += ` L ${x},${by}`;
    else waterPath += ` L ${x},${by}`;
  }
  beachPath += ` L ${width},${y + 100} L 0,${y + 100} Z`;
  waterPath += ` L 0,${y - 200} L ${width},${y - 200} Z`;

  return (
    <g>
      <path d={waterPath} fill={waterColor} opacity={0.8} />
      <path d={beachPath} fill={sandColor} opacity={0.85} />
      <rect x={0} y={y - 200} width={width} height={400} fill={tint} opacity={tintOpacity} />
    </g>
  );
});

// ---------- Tundra / Snow ----------

export const SnowDrift = memo(function SnowDrift({ x, y, scale, tint, tintOpacity, seed }: ElementProps) {
  const w = (60 + Math.abs(Math.sin(seed * 2.3)) * 40) * scale;
  const h = (8 + Math.abs(Math.cos(seed * 3.1)) * 6) * scale;
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx={0} cy={0} rx={w / 2} ry={h} fill="#d0d8e0" opacity={0.8} />
      <ellipse cx={w * 0.15} cy={-h * 0.3} rx={w * 0.3} ry={h * 0.6} fill="#e0e8f0" opacity={0.6} />
      <rect x={-w / 2} y={-h} width={w} height={h * 2} fill={tint} opacity={tintOpacity} />
    </g>
  );
});

// ---------- Helper: Seeded random ----------

export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
