import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface StylizedGroundProps {
  altitude: number;
  speed: number;
  phase: string;
  horizonColor: THREE.Color;
  groundColor: THREE.Color;
}

// Build a repeating runway texture: dashed centre-line, edge stripes, asphalt.
function makeRunwayTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  // Asphalt base
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, W, H);

  // Subtle asphalt noise
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const g = 30 + Math.random() * 20;
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Edge stripes (left and right)
  ctx.fillStyle = '#eeeeee';
  ctx.fillRect(30, 0, 8, H);
  ctx.fillRect(W - 38, 0, 8, H);

  // Dashed centre-line
  const dashLen = 60;
  const gapLen = 40;
  ctx.fillStyle = '#dddddd';
  for (let y = 0; y < H; y += dashLen + gapLen) {
    ctx.fillRect(W / 2 - 4, y, 8, dashLen);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 8);
  tex.needsUpdate = true;
  return tex;
}

// Build a subtle terrain grid texture for mid/high altitude ground.
function makeTerrainTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, S, S);

  // Faint grid lines (roads / field boundaries)
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  const spacing = 64;
  for (let i = 0; i <= S; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  tex.needsUpdate = true;
  return tex;
}

// A smooth, stylized "earth floor" far below the camera with speed-driven
// scrolling. At low altitude (taxi/takeoff/landing) runway markings whip past;
// at cruise altitude the ground plane drifts slowly with a subtle terrain grid.
export function StylizedGround({ altitude, speed, phase, horizonColor, groundColor }: StylizedGroundProps) {
  const groundMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const runwayMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const hazeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const terrainMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const { scene } = useThree();

  const scrollRef = useRef(0);

  const runwayTex = useMemo(makeRunwayTexture, []);
  const terrainTex = useMemo(makeTerrainTexture, []);

  const isOnGround = phase === 'BOARDING' || phase === 'TAXI' || phase === 'TAKEOFF'
    || phase === 'LANDING' || phase === 'ARRIVED';

  const groundDepth = useMemo(() => {
    const clamped = Math.max(500, Math.min(40000, altitude));
    return 10 + (clamped / 40000) * 55;
  }, [altitude]);

  // Vertical alpha gradient for the horizon haze (opaque at horizon → clear up).
  const hazeAlpha = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#aaaaaa');
    g.addColorStop(0.75, '#222222');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => {
    scene.fog = new THREE.Fog(horizonColor.clone(), groundDepth * 1.4, groundDepth * 6.5);
    return () => {
      scene.fog = null;
    };
  }, [scene, groundDepth, horizonColor]);

  useFrame((_, delta) => {
    if (groundMatRef.current) groundMatRef.current.color.copy(groundColor);
    if (hazeMatRef.current) hazeMatRef.current.color.copy(horizonColor);

    // Scroll runway texture based on speed (knots → rough world-units/s).
    // At 160 kts takeoff, lines should whip past fast.
    const scrollSpeed = speed * 0.012;
    scrollRef.current += scrollSpeed * delta;

    if (runwayMatRef.current && runwayMatRef.current.map) {
      // Negative offset: runway markings scroll right-to-left (backward) as
      // seen from a side window seat looking forward.
      runwayMatRef.current.map.offset.y = -scrollRef.current;
      runwayMatRef.current.map.needsUpdate = true;
    }

    // Terrain grid drifts slowly at altitude.
    if (terrainMatRef.current && terrainMatRef.current.map) {
      terrainMatRef.current.map.offset.y = scrollRef.current * 0.15;
      terrainMatRef.current.map.needsUpdate = true;
    }
  });

  // Runway strip opacity: fully visible on ground, fading out during climb.
  const runwayOpacity = isOnGround ? 1.0
    : altitude < 5000 ? 1.0 - altitude / 5000
    : 0;

  // Terrain grid opacity: invisible on ground, fades in above 3000 ft.
  const terrainOpacity = altitude < 3000 ? 0
    : altitude < 10000 ? (altitude - 3000) / 7000
    : 0.6;

  return (
    <group>
      {/* Main ground plane */}
      <group position={[0, -groundDepth, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[groundDepth * 16, groundDepth * 16, 1, 1]} />
          <meshStandardMaterial
            ref={groundMatRef}
            color={groundColor}
            roughness={0.9}
            metalness={0}
            fog
          />
        </mesh>
      </group>

      {/* Runway strip — visible at low altitude, oriented side-to-side, shifted left */}
      {runwayOpacity > 0.01 && (
        <group position={[-groundDepth * 1.2, -groundDepth + 0.05, -groundDepth * 1.5]} rotation={[-Math.PI / 2, Math.PI / 2, 0]}>
          <mesh>
            <planeGeometry args={[20, groundDepth * 12, 1, 1]} />
            <meshBasicMaterial
              ref={runwayMatRef}
              map={runwayTex}
              transparent
              opacity={runwayOpacity}
              depthWrite={false}
              fog
            />
          </mesh>
        </group>
      )}

      {/* Terrain grid overlay — visible at mid/high altitude */}
      {terrainOpacity > 0.01 && (
        <group position={[0, -groundDepth + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <planeGeometry args={[groundDepth * 16, groundDepth * 16, 1, 1]} />
            <meshBasicMaterial
              ref={terrainMatRef}
              map={terrainTex}
              transparent
              opacity={terrainOpacity}
              depthWrite={false}
              fog
            />
          </mesh>
        </group>
      )}

      {/* Horizon haze curtain */}
      <mesh position={[0, groundDepth * 0.55, -groundDepth * 5.5]}>
        <planeGeometry args={[groundDepth * 40, groundDepth * 3.5, 1, 1]} />
        <meshBasicMaterial
          ref={hazeMatRef}
          color={horizonColor}
          alphaMap={hazeAlpha}
          transparent
          opacity={1}
          depthWrite={false}
          fog={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
