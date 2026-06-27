import { useMemo, useRef } from 'react';
import { Clouds, Cloud } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CloudFieldProps {
  altitude: number;
  sunNorm: number; // 0..1 daylight strength
  warmth: number; // 0..1 golden-hour warmth
  cloudColor: THREE.Color;
}

interface Puff {
  position: [number, number, number];
  scale: number;
  seed: number;
}

interface Layout {
  y: number;
  halfWidth: number;
  depth: number;
  spacing: number;
  opacity: number;
  thin: boolean;
}

// Soft, stylized sea of clouds. Puffs overlap on a grid to form a continuous
// carpet rather than scattered blobs, sitting below the horizon so the
// downward window view looks out over it.
export function CloudField({ altitude, sunNorm, warmth, cloudColor }: CloudFieldProps) {
  const driftRef = useRef<THREE.Group>(null);

  const layout = useMemo<Layout>(() => {
    if (altitude < 4000) {
      // Near the ground: a thin, high broken layer overhead.
      return { y: 34, halfWidth: 160, depth: 320, spacing: 90, opacity: 0.5, thin: true };
    }
    if (altitude < 14000) {
      return { y: 2, halfWidth: 150, depth: 320, spacing: 74, opacity: 0.8, thin: false };
    }
    if (altitude < 26000) {
      return { y: -10, halfWidth: 180, depth: 380, spacing: 78, opacity: 0.85, thin: false };
    }
    // High cruise: a broad deck well below the horizon.
    return { y: -18, halfWidth: 200, depth: 420, spacing: 82, opacity: 0.9, thin: false };
  }, [altitude]);

  const puffs = useMemo<Puff[]>(() => {
    const out: Puff[] = [];
    const cols = Math.max(3, Math.round((layout.halfWidth * 2) / layout.spacing));
    const rows = Math.max(3, Math.round(layout.depth / layout.spacing));
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const jx = Math.sin(i * 91.7) * layout.spacing * 0.35;
        const jz = Math.cos(i * 57.3) * layout.spacing * 0.35;
        const x = -layout.halfWidth + (cIdx / (cols - 1)) * layout.halfWidth * 2 + jx;
        const z = -10 - (r / (rows - 1)) * layout.depth + jz;
        const y = layout.y + Math.sin(i * 12.9) * (layout.thin ? 6 : 3);
        out.push({
          position: [x, y, z],
          scale: layout.spacing * (0.95 + Math.abs(Math.sin(i * 33.1)) * 0.5),
          seed: i * 13 + 1,
        });
        i++;
      }
    }
    return out;
  }, [layout]);

  // Bright, soft clouds: near-white in daylight, warm at golden hour, and still
  // a readable moonlit grey at night.
  const topColor = useMemo(() => {
    const white = new THREE.Color('#ffffff');
    const warm = new THREE.Color('#ffd2a0');
    const c = cloudColor.clone();
    c.lerp(white, 0.35 + sunNorm * 0.5);
    c.lerp(warm, warmth * 0.45);
    return c;
  }, [cloudColor, sunNorm, warmth]);

  useFrame((_, delta) => {
    if (driftRef.current) {
      driftRef.current.position.z += delta * (altitude > 20000 ? 6 : 10);
      if (driftRef.current.position.z > layout.spacing) {
        driftRef.current.position.z = 0;
      }
    }
  });

  return (
    <group ref={driftRef}>
      <Clouds material={THREE.MeshBasicMaterial} limit={600} range={puffs.length}>
        {puffs.map((p, i) => (
          <Cloud
            key={i}
            seed={p.seed}
            position={p.position}
            scale={p.scale}
            opacity={layout.opacity}
            speed={0.08}
            growth={8}
            segments={14}
            color={topColor}
            volume={layout.thin ? 7 : 14}
            bounds={layout.thin ? [18, 6, 18] : [layout.spacing * 0.9, 5, layout.spacing * 0.9]}
            concentrate="inside"
            fade={layout.depth * 1.5}
          />
        ))}
      </Clouds>
    </group>
  );
}
