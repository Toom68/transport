import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getCloudTextures } from './cloudTextures';

interface RealisticCloudFieldProps {
  altitude: number;
  sunNorm: number; // 0..1 daylight strength
  warmth: number; // 0..1 golden-hour warmth
  cloudColor: THREE.Color;
  cloudDensity: number; // 0..1 from weather
  isOvercast: boolean;
}

interface CloudSprite {
  position: [number, number, number];
  scale: number;
  rotation: number;
  texture: 'cumulus' | 'cirrus' | 'stratus';
  opacity: number;
  driftSpeed: number;
}

// Billboard cloud system using textured sprites. Much more realistic than
// the procedural drei Cloud component — uses PNG-like textures generated
// via canvas with layered radial gradients for cumulus, cirrus, and stratus.
export function RealisticCloudField({
  altitude,
  sunNorm,
  warmth,
  cloudColor,
  cloudDensity,
  isOvercast,
}: RealisticCloudFieldProps) {
  const groupRef = useRef<THREE.Group>(null);
  const textures = useMemo(getCloudTextures, []);

  // Determine cloud layer based on altitude.
  const layer = useMemo(() => {
    if (altitude < 4000) {
      // Near ground: scattered cumulus overhead, some cirrus far above
      return { y: 30, depth: 400, count: 12, type: 'cumulus' as const, opacity: 0.7 * cloudDensity };
    }
    if (altitude < 14000) {
      // Climbing through clouds
      return { y: 5, depth: 350, count: 18, type: 'cumulus' as const, opacity: 0.85 * cloudDensity };
    }
    if (altitude < 26000) {
      // Mid-cruise: above most weather, scattered cumulus below, cirrus at level
      return { y: -12, depth: 450, count: 16, type: 'cumulus' as const, opacity: 0.8 * cloudDensity };
    }
    // High cruise: looking down at cloud deck, cirrus at level
    return { y: -20, depth: 500, count: 14, type: 'cumulus' as const, opacity: 0.75 * cloudDensity };
  }, [altitude, cloudDensity]);

  // Generate cloud sprites with deterministic positions.
  const sprites = useMemo<CloudSprite[]>(() => {
    const out: CloudSprite[] = [];
    const count = isOvercast ? Math.round(layer.count * 1.8) : layer.count;

    for (let i = 0; i < count; i++) {
      // Deterministic pseudo-random based on index
      const seed = i * 137.5;
      const rand = (n: number) => {
        const x = Math.sin(seed + n * 12.9898) * 43758.5453;
        return x - Math.floor(x);
      };

      const x = (rand(1) - 0.5) * 400;
      const z = -10 - rand(2) * layer.depth;
      const y = layer.y + (rand(3) - 0.5) * (isOvercast ? 8 : 15);

      const scale = isOvercast
        ? 60 + rand(4) * 40
        : 30 + rand(4) * 50;

      // At high altitude, add some cirrus wisps at flight level
      const texture: 'cumulus' | 'cirrus' | 'stratus' =
        isOvercast ? 'stratus' :
        altitude > 26000 && rand(5) > 0.7 ? 'cirrus' :
        'cumulus';

      out.push({
        position: [x, y, z],
        scale,
        rotation: rand(6) * Math.PI * 2,
        texture,
        opacity: layer.opacity * (0.6 + rand(7) * 0.4),
        driftSpeed: 0.3 + rand(8) * 0.5,
      });
    }
    return out;
  }, [layer, isOvercast, altitude]);

  // Compute cloud tint based on lighting
  const cloudTint = useMemo(() => {
    const white = new THREE.Color('#ffffff');
    const warm = new THREE.Color('#ffd2a0');
    const dark = new THREE.Color('#3a4258');
    const c = cloudColor.clone();

    // Brighten toward white in daylight, darken in shadow
    c.lerp(white, 0.3 + sunNorm * 0.4);
    // Warm tint at golden hour
    c.lerp(warm, warmth * 0.4);
    // Darker clouds for overcast/stormy
    if (isOvercast) {
      c.lerp(dark, 0.2);
    }
    return c;
  }, [cloudColor, sunNorm, warmth, isOvercast]);

  // Drift animation
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.z += delta * (altitude > 20000 ? 4 : 8);
      // Wrap around
      if (groupRef.current.position.z > 100) {
        groupRef.current.position.z = 0;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {sprites.map((sprite, i) => {
        const tex = sprite.texture === 'cumulus' ? textures.cumulus
          : sprite.texture === 'cirrus' ? textures.cirrus
          : textures.stratus;

        return (
          <CloudBillboard
            key={i}
            position={sprite.position}
            scale={sprite.scale}
            rotation={sprite.rotation}
            texture={tex}
            opacity={sprite.opacity}
            color={cloudTint}
          />
        );
      })}
    </group>
  );
}

// A single billboarded cloud sprite that always faces the camera.
function CloudBillboard({
  position,
  scale,
  rotation,
  texture,
  opacity,
  color,
}: {
  position: [number, number, number];
  scale: number;
  rotation: number;
  texture: THREE.Texture;
  opacity: number;
  color: THREE.Color;
}) {
  const material = useMemo(() => {
    return new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity,
      color,
      depthWrite: false,
      fog: true,
    });
  }, [texture]);

  // Update color and opacity when they change
  useMemo(() => {
    material.color.copy(color);
    material.opacity = opacity;
    material.needsUpdate = true;
  }, [material, color, opacity]);

  return (
    <sprite position={position} scale={[scale, scale, 1]} material={material} />
  );
}
