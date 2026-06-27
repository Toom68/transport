import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, createPortal } from '@react-three/fiber';
import * as THREE from 'three';

interface AircraftWingProps {
  phase: string;
  altitude: number;
  isDaytime: boolean;
}

// A procedurally-built 3D airliner wing (planform + engine nacelle + winglet),
// parented to the camera so it stays fixed in the window like a real over-wing
// seat. Lit by the scene's world-space sun, with a navigation/strobe light.
export function AircraftWing({ phase, altitude, isDaytime }: AircraftWingProps) {
  const { camera, scene } = useThree();
  const tipRef = useRef<THREE.Group>(null);
  const navLightRef = useRef<THREE.Mesh>(null);
  const navPointRef = useRef<THREE.PointLight>(null);
  const strobeRef = useRef(0);

  // Build the wing planform as a tapered, swept shape extruded for thickness.
  const wingGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    // Root (near fuselage) at x=0; tip at x = span. Sweep back in z.
    const span = 9;
    shape.moveTo(0, 0); // leading edge root
    shape.lineTo(0, 3.4); // trailing edge root (chord = 3.4)
    shape.lineTo(span, 2.0); // trailing edge tip (swept)
    shape.lineTo(span, 1.2); // leading edge tip (chord ~0.8)
    shape.lineTo(0, 0);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 3,
      steps: 1,
    });
    geo.center();
    return geo;
  }, []);

  const wingletGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, 1.2);
    shape.lineTo(1.6, 0.6);
    shape.lineTo(1.6, 0.1);
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
      steps: 1,
    });
    geo.center();
    return geo;
  }, []);

  // R3F does not add a custom camera to the scene graph, so camera children
  // won't render unless we add the camera to the scene ourselves. We then
  // portal the wing into the camera so it stays locked to the view.
  useEffect(() => {
    scene.add(camera);
    return () => {
      scene.remove(camera);
    };
  }, [camera, scene]);

  // Per-phase wing flex: more upward bend under cruise load, droop on ground.
  const targetFlex = useMemo(() => {
    switch (phase) {
      case 'BOARDING':
      case 'TAXI':
        return -0.05; // slight droop at rest
      case 'TAKEOFF':
        return 0.14; // stronger flex as lift builds
      case 'CLIMB':
        return 0.16;
      case 'CRUISE':
        return 0.18;
      case 'DESCENT':
      case 'APPROACH':
        return 0.10;
      case 'LANDING':
        return 0.04;
      case 'ARRIVED':
        return -0.04;
      default:
        return 0.0;
    }
  }, [phase]);

  const flexRef = useRef(0);

  // Landing bounce: damped spring on touchdown
  const bounceRef = useRef({ active: false, triggered: false, value: 0, velocity: 0 });
  const prevAltRef = useRef(altitude);

  // Flutter amplitude per phase
  const flutterAmp = useMemo(() => {
    switch (phase) {
      case 'BOARDING':
      case 'ARRIVED':
        return 0.002;
      case 'TAXI':
        return 0.006;
      case 'TAKEOFF':
        return 0.015;
      case 'CLIMB':
        return 0.012;
      case 'CRUISE':
        return 0.008;
      case 'DESCENT':
      case 'APPROACH':
        return 0.010;
      case 'LANDING':
        return 0.018;
      default:
        return 0.005;
    }
  }, [phase]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = performance.now() * 0.001;

    // ---------- landing bounce detection ----------
    const bounce = bounceRef.current;
    if (phase === 'LANDING' && !bounce.triggered && prevAltRef.current > 80 && altitude <= 80) {
      bounce.active = true;
      bounce.triggered = true;
      bounce.value = -0.12; // sharp downward flex (gear compression)
      bounce.velocity = 0.8;
    }
    if (phase !== 'LANDING') {
      bounce.triggered = false;
    }
    prevAltRef.current = altitude;

    // Damped spring for bounce recovery
    if (bounce.active) {
      bounce.value += bounce.velocity * dt;
      bounce.velocity -= bounce.value * 35 * dt;
      bounce.velocity *= 0.90;
      if (Math.abs(bounce.value) < 0.001 && Math.abs(bounce.velocity) < 0.01) {
        bounce.active = false;
        bounce.value = 0;
        bounce.velocity = 0;
      }
    }

    // ---------- smooth flex toward target + flutter ----------
    const flexSpeed = phase === 'TAKEOFF' ? 2.0 : 1.5;
    flexRef.current += (targetFlex - flexRef.current) * Math.min(1, dt * flexSpeed);

    if (tipRef.current) {
      const flutter = (Math.sin(t * 1.7) + Math.sin(t * 3.1) * 0.5 + Math.sin(t * 5.3) * 0.25) * flutterAmp;
      tipRef.current.rotation.z = flexRef.current + flutter + bounce.value;
    }

    // Navigation light: solid red glow at day, strobing at night.
    strobeRef.current += delta;
    let navIntensity = isDaytime ? 0.4 : 0.9;
    if (!isDaytime) {
      const strobePhase = strobeRef.current % 2.0;
      navIntensity = strobePhase < 0.08 || (strobePhase > 0.16 && strobePhase < 0.24) ? 3.0 : 0.5;
    }
    if (navLightRef.current) {
      const mat = navLightRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = navIntensity;
    }
    if (navPointRef.current) {
      navPointRef.current.intensity = navIntensity * 0.6;
    }
  });

  // Painted-aluminium wing. Low metalness (painted surfaces aren't mirrors, and
  // metalness with no env map renders black), satin roughness so diffuse light
  // reads it properly day and night.
  const paintColor = isDaytime ? '#dde2e8' : '#8a93a3';

  return createPortal(
    // Position the root near the lower-left of the window, wing sweeping
    // out across the bottom of the view toward the tip/winglet.
    <group position={[-1.6, -1.7, -4.2]} rotation={[-0.32, 0.5, 0.06]}>
      {/* Warm cabin light spilling onto the wing root (keeps it visible at night) */}
      <pointLight position={[-1, 1.2, 2]} color="#ffd9a0" intensity={0.5} distance={10} />

      <group ref={tipRef}>
        {/* Main wing surface */}
        <mesh geometry={wingGeometry} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <meshStandardMaterial
            color={paintColor}
            roughness={0.5}
            metalness={0.15}
          />
        </mesh>

        {/* Engine nacelle slung under the wing, near the root */}
        <group position={[2.4, -0.7, 0.4]} rotation={[0, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.75, 0.7, 2.6, 24, 1, true]} />
            <meshStandardMaterial
              color={isDaytime ? '#c8cdd4' : '#5a6473'}
              roughness={0.45}
              metalness={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Intake lip */}
          <mesh position={[-1.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.74, 0.08, 12, 24]} />
            <meshStandardMaterial color="#1a1d22" roughness={0.5} metalness={0.6} />
          </mesh>
          {/* Fan face (dark) */}
          <mesh position={[-1.28, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <circleGeometry args={[0.66, 24]} />
            <meshStandardMaterial color="#0c0e12" roughness={0.8} metalness={0.3} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* Winglet at the tip, angled up */}
        <group position={[6.0, 0.1, -0.6]} rotation={[Math.PI / 2, 0.5, -0.2]}>
          <mesh geometry={wingletGeometry}>
            <meshStandardMaterial color={paintColor} roughness={0.5} metalness={0.15} />
          </mesh>
        </group>

        {/* Navigation/strobe light at the wingtip */}
        <mesh ref={navLightRef} position={[6.4, 0.3, -0.7]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial
            color="#ff2222"
            emissive="#ff0000"
            emissiveIntensity={0.6}
          />
        </mesh>
        <pointLight ref={navPointRef} position={[6.4, 0.3, -0.7]} color="#ff2020" intensity={0.4} distance={6} />
      </group>
    </group>,
    camera
  );
}
