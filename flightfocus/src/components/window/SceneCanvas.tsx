import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import type { getSolarPosition } from '@/utils/time';
import { Sky3D } from './Sky3D';
import { StylizedGround } from './StylizedGround';
import { RealisticCloudField } from './RealisticCloudField';
import { AircraftWing } from './AircraftWing';
import { CameraRig } from './CameraRig';
import { useFrame } from '@react-three/fiber';
import type { WeatherCondition } from '@/types/weather';
import { cloudDensity, isOvercast as isOvercastCondition } from '@/types/weather';

type SolarData = ReturnType<typeof getSolarPosition> | null;

interface SceneCanvasProps {
  altitude: number;
  phase: string;
  speed: number;
  progress: number;
  solarData: SolarData;
  weatherCondition?: WeatherCondition;
}

// Convert solar altitude/azimuth (degrees) into a normalized direction vector.
function sunDirection(altitudeDeg: number, azimuthDeg: number): [number, number, number] {
  const el = (altitudeDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  const x = Math.cos(el) * Math.sin(az);
  const y = Math.sin(el);
  const z = Math.cos(el) * Math.cos(az);
  return [x, y, z];
}

function SunLight({
  dir,
  intensity,
  isDaytime,
}: {
  dir: [number, number, number];
  intensity: number;
  isDaytime: boolean;
}) {
  const lightRef = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    if (lightRef.current) {
      lightRef.current.position.set(dir[0] * 100, Math.max(2, dir[1] * 100), dir[2] * 100);
    }
  });

  // Warm sunlight near horizon, neutral high in the sky.
  const sunColor = useMemo(() => {
    const horizonWarmth = Math.max(0, 1 - Math.max(0, dir[1]) * 3);
    const c = new THREE.Color('#fff4e0');
    c.lerp(new THREE.Color('#ff8c42'), horizonWarmth * 0.7);
    return c;
  }, [dir]);

  return (
    <>
      <directionalLight ref={lightRef} intensity={Math.max(0.35, intensity)} color={sunColor} />
      <ambientLight intensity={isDaytime ? 0.5 : 0.4} color={isDaytime ? '#bcd2e8' : '#3a4866'} />
      {/* Subtle sky-fill from above */}
      <hemisphereLight
        intensity={isDaytime ? 0.4 : 0.28}
        color={isDaytime ? '#cfe2f5' : '#2a3a5c'}
        groundColor={isDaytime ? '#5a6a4a' : '#10141c'}
      />
    </>
  );
}

export function SceneCanvas({ altitude, phase, speed, progress, solarData, weatherCondition }: SceneCanvasProps) {
  const weatherCond = weatherCondition ?? 'clear';
  const density = cloudDensity(weatherCond);
  const overcast = isOvercastCondition(weatherCond);
  const sunAltDeg = solarData ? solarData.altitude : -20;
  const sunAzDeg = solarData ? solarData.azimuth : 180;
  const isDaytime = solarData ? solarData.isDaytime : false;

  const dir = useMemo(() => sunDirection(sunAltDeg, sunAzDeg), [sunAltDeg, sunAzDeg]);

  // Sun intensity: strong by day, fading through twilight, ~0 at night.
  const sunIntensity = useMemo(() => {
    if (sunAltDeg > 10) return 2.4;
    if (sunAltDeg > 0) return 1.2 + (sunAltDeg / 10) * 1.2;
    if (sunAltDeg > -6) return 0.4 + ((sunAltDeg + 6) / 6) * 0.8; // golden/blue hour
    return 0.05;
  }, [sunAltDeg]);

  // Normalized daylight strength for tinting (0 night .. 1 bright day).
  const sunNorm = useMemo(() => Math.max(0, Math.min(1, (sunAltDeg + 4) / 40)), [sunAltDeg]);

  // Golden-hour warmth: peaks when the sun is near the horizon.
  const warmth = useMemo(() => {
    if (sunAltDeg > 12 || sunAltDeg < -8) return 0;
    return Math.max(0, 1 - Math.abs(sunAltDeg) / 10);
  }, [sunAltDeg]);

  // Horizon colour: drives fog + haze so the ground melts into the sky.
  const horizonColor = useMemo(() => {
    const night = new THREE.Color('#0b1320');
    const day = new THREE.Color('#b9d2e8');
    const warm = new THREE.Color('#e89a5c');
    const c = night.clone();
    c.lerp(day, Math.min(1, sunNorm * 1.2));
    c.lerp(warm, warmth * 0.8);
    return c;
  }, [sunNorm, warmth]);

  // Base cloud colour (night/shadow tone); CloudField brightens toward white.
  const cloudColor = useMemo(() => {
    const night = new THREE.Color('#5a647a');
    const day = new THREE.Color('#d8e2ee');
    return night.clone().lerp(day, Math.min(1, sunNorm * 0.8));
  }, [sunNorm]);

  // Stylized ground colour (no geography): soft teal-green by day, deep navy at
  // night, warmed slightly at golden hour.
  const groundColor = useMemo(() => {
    const night = new THREE.Color('#101d2c');
    const day = new THREE.Color('#3f6b6e');
    const warm = new THREE.Color('#6e5a52');
    const c = night.clone();
    c.lerp(day, Math.min(1, sunNorm * 1.1));
    c.lerp(warm, warmth * 0.5);
    return c;
  }, [sunNorm, warmth]);

  return (
    <Canvas
      camera={{ fov: 68, near: 0.1, far: 500000, position: [0, 0, 0] }}
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: isDaytime ? 1.0 : 1.25,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <SunLight dir={dir} intensity={sunIntensity} isDaytime={isDaytime} />

      <Sky3D sunDir={dir} sunAltitudeDeg={sunAltDeg} isDaytime={isDaytime} warmth={warmth} />

      <StylizedGround altitude={altitude} speed={speed} phase={phase} horizonColor={horizonColor} groundColor={groundColor} />

      <RealisticCloudField
        altitude={altitude}
        sunNorm={sunNorm}
        warmth={warmth}
        cloudColor={cloudColor}
        cloudDensity={density}
        isOvercast={overcast}
      />

      <AircraftWing phase={phase} altitude={altitude} isDaytime={isDaytime} />

      <CameraRig phase={phase} altitude={altitude} speed={speed} progress={progress} />
    </Canvas>
  );
}
