import { useMemo, useRef } from 'react';
import { Sky, Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Sky3DProps {
  sunDir: [number, number, number]; // normalized
  sunAltitudeDeg: number;
  isDaytime: boolean;
  warmth: number; // 0..1 golden-hour
}

// Radial glow sprite texture (bright centre fading out).
function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,250,235,0.9)');
  g.addColorStop(0.4, 'rgba(255,225,170,0.35)');
  g.addColorStop(0.75, 'rgba(255,190,120,0.08)');
  g.addColorStop(1, 'rgba(255,180,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function Sky3D({ sunDir, sunAltitudeDeg, isDaytime, warmth }: Sky3DProps) {
  const moonRef = useRef<THREE.Group>(null);
  const glowTex = useMemo(makeGlowTexture, []);

  const sunPosition = useMemo<[number, number, number]>(
    () => [sunDir[0] * 100, sunDir[1] * 100, sunDir[2] * 100],
    [sunDir]
  );

  // Sun sprite placed far along the sun direction.
  const sunWorld = useMemo<[number, number, number]>(
    () => [sunDir[0] * 380, sunDir[1] * 380, sunDir[2] * 380],
    [sunDir]
  );

  const skyParams = useMemo(() => {
    if (sunAltitudeDeg > 8) {
      return { turbidity: 6, rayleigh: 1.3, mieCoefficient: 0.005, mieDirectionalG: 0.8 };
    }
    return {
      turbidity: 10 + warmth * 6,
      rayleigh: isDaytime ? 2 + warmth * 2 : 0.4,
      mieCoefficient: 0.005 + warmth * 0.025,
      mieDirectionalG: 0.85 + warmth * 0.1,
    };
  }, [sunAltitudeDeg, warmth, isDaytime]);

  const showSun = sunAltitudeDeg > -4;
  const showStars = sunAltitudeDeg < -3;
  const showMoon = sunAltitudeDeg < -7;

  // Sun colour: white high up, deep orange near the horizon.
  const sunColor = useMemo(() => {
    const c = new THREE.Color('#fff6e6');
    c.lerp(new THREE.Color('#ff7a2a'), warmth);
    return c;
  }, [warmth]);

  // Glow scale grows near the horizon for a big setting-sun look.
  const glowScale = 26 + warmth * 70;
  const discScale = 12 + warmth * 10;

  useFrame(({ clock }) => {
    if (moonRef.current) {
      moonRef.current.position.x = -55 + Math.sin(clock.getElapsedTime() * 0.02) * 2;
    }
  });

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={sunPosition}
        turbidity={skyParams.turbidity}
        rayleigh={skyParams.rayleigh}
        mieCoefficient={skyParams.mieCoefficient}
        mieDirectionalG={skyParams.mieDirectionalG}
      />

      {showSun && (
        <group position={sunWorld}>
          {/* Outer glow */}
          <sprite scale={[glowScale, glowScale, 1]}>
            <spriteMaterial
              map={glowTex}
              color={sunColor}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              opacity={0.9}
            />
          </sprite>
          {/* Bright disc */}
          <sprite scale={[discScale, discScale, 1]}>
            <spriteMaterial
              map={glowTex}
              color={sunColor}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        </group>
      )}

      {showStars && (
        <Stars radius={300} depth={80} count={3500} factor={4} saturation={0} fade speed={0.3} />
      )}

      {showMoon && (
        <group ref={moonRef} position={[-55, 42, -150]}>
          <mesh>
            <sphereGeometry args={[2.4, 32, 32]} />
            <meshBasicMaterial color="#e8edf5" />
          </mesh>
          <sprite scale={[16, 16, 1]}>
            <spriteMaterial
              map={glowTex}
              color="#aab8d0"
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              opacity={0.5}
            />
          </sprite>
        </group>
      )}
    </>
  );
}
