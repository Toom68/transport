import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

interface CameraRigProps {
  phase: string;
  altitude: number;
  speed: number;
  progress: number;
}

// ---------- helpers ----------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Attempt at a smooth pseudo-random value based on time. Multiple layered
// sine waves at irrational-ratio frequencies feel organic without needing a
// PRNG state.
function noise(t: number): number {
  return (
    Math.sin(t * 1.0) * 0.5 +
    Math.sin(t * 2.31) * 0.25 +
    Math.sin(t * 4.73) * 0.15 +
    Math.sin(t * 7.19) * 0.1
  );
}

// ---------- per-phase target generators ----------

function getTargetPitch(phase: string, altitude: number, speed: number): number {
  switch (phase) {
    case 'BOARDING':
      return -0.12;
    case 'TAXI':
      return -0.10;
    case 'TAKEOFF': {
      // As speed builds on the runway, nose starts to rotate up.
      // Below ~80 kts still flat; 80→160 kts the rotation happens.
      const speedT = clamp01((speed - 40) / 120);
      const altT = clamp01(altitude / 5000);
      return lerp(-0.08, 0.32, Math.max(speedT * 0.6, altT));
    }
    case 'CLIMB': {
      const t = clamp01((altitude - 5000) / 31000);
      return lerp(0.28, 0.04, t); // pitched up, easing level
    }
    case 'CRUISE':
      return 0.02;
    case 'DESCENT': {
      const t = clamp01((36000 - altitude) / 26000);
      return lerp(0.02, -0.14, t);
    }
    case 'APPROACH': {
      const t = clamp01((10000 - altitude) / 8000);
      return lerp(-0.14, -0.20, t);
    }
    case 'LANDING': {
      const t = clamp01((2000 - altitude) / 2000);
      // Flare: nose pitches back up near touchdown.
      if (t > 0.85) return lerp(-0.20, -0.06, (t - 0.85) / 0.15);
      return -0.20;
    }
    case 'ARRIVED':
      return -0.12;
    default:
      return 0;
  }
}

function getTargetRoll(phase: string, t: number): number {
  // Banking: slow sine waves whose amplitude and period vary per phase.
  switch (phase) {
    case 'BOARDING':
    case 'ARRIVED':
      return 0;
    case 'TAXI':
      return Math.sin(t * 0.4) * 0.006; // almost nothing
    case 'TAKEOFF':
      return Math.sin(t * 0.6) * 0.015; // tiny wing-rock
    case 'CLIMB':
      // Moderate bank — plane is turning out of the departure
      return Math.sin(t * 0.18) * 0.08 + Math.sin(t * 0.47) * 0.03;
    case 'CRUISE':
      // Gentle, slow rolling — occasional course corrections
      return Math.sin(t * 0.10) * 0.04 + Math.sin(t * 0.27) * 0.02;
    case 'DESCENT':
      return Math.sin(t * 0.15) * 0.05 + Math.sin(t * 0.38) * 0.025;
    case 'APPROACH':
      // More frequent smaller corrections on approach
      return Math.sin(t * 0.25) * 0.045 + Math.sin(t * 0.55) * 0.02;
    case 'LANDING':
      return Math.sin(t * 0.3) * 0.02;
    default:
      return 0;
  }
}

interface TurbulenceConfig {
  pitchAmp: number;
  rollAmp: number;
  yawAmp: number;
  freqScale: number;
}

function getTurbulence(phase: string, altitude: number, speed: number): TurbulenceConfig {
  switch (phase) {
    case 'BOARDING':
    case 'ARRIVED':
      return { pitchAmp: 0, rollAmp: 0, yawAmp: 0, freqScale: 1 };
    case 'TAXI':
      // Ground rumble — high frequency, low amplitude
      return { pitchAmp: 0.005, rollAmp: 0.003, yawAmp: 0.002, freqScale: 3.5 };
    case 'TAKEOFF': {
      // Vibration builds with speed, then smooths as wheels leave ground
      const groundFactor = altitude < 200 ? 1.0 : Math.max(0, 1 - (altitude - 200) / 1000);
      const speedFactor = clamp01(speed / 160);
      const amp = speedFactor * groundFactor;
      return {
        pitchAmp: 0.008 * amp + 0.003,
        rollAmp: 0.005 * amp + 0.002,
        yawAmp: 0.003 * amp,
        freqScale: 2.5 + amp * 2.0,
      };
    }
    case 'CLIMB':
      return { pitchAmp: 0.005, rollAmp: 0.004, yawAmp: 0.002, freqScale: 1.8 };
    case 'CRUISE':
      // Light but alive — the signature cruise feel
      return {
        pitchAmp: altitude > 30000 ? 0.0025 : 0.004,
        rollAmp: altitude > 30000 ? 0.002 : 0.003,
        yawAmp: 0.001,
        freqScale: 1.2,
      };
    case 'DESCENT':
      return { pitchAmp: 0.006, rollAmp: 0.005, yawAmp: 0.003, freqScale: 1.6 };
    case 'APPROACH':
      return { pitchAmp: 0.007, rollAmp: 0.006, yawAmp: 0.003, freqScale: 2.0 };
    case 'LANDING': {
      // Ground rumble resumes after touchdown
      const onGround = altitude < 50 ? 1.0 : 0.3;
      return {
        pitchAmp: 0.008 * onGround + 0.003,
        rollAmp: 0.005 * onGround + 0.002,
        yawAmp: 0.003 * onGround,
        freqScale: 2.0 + onGround * 2.0,
      };
    }
    default:
      return { pitchAmp: 0, rollAmp: 0, yawAmp: 0, freqScale: 1 };
  }
}

// Smoothing rate per phase (how fast we interpolate toward the target).
function getSmoothRate(phase: string): number {
  switch (phase) {
    case 'TAKEOFF':
      return 1.5; // snappy rotation
    case 'CLIMB':
      return 0.8;
    case 'CRUISE':
      return 0.4; // slow, gentle drift
    case 'LANDING':
      return 2.0; // responsive flare
    case 'ARRIVED':
      return 1.2;
    default:
      return 1.0;
  }
}

export function CameraRig({ phase, altitude, speed, progress }: CameraRigProps) {
  const { camera } = useThree();
  const pitchRef = useRef(0);
  const rollRef = useRef(0);
  const yawRef = useRef(0);

  // Landing jolt state
  const joltRef = useRef({ active: false, triggered: false, value: 0, velocity: 0 });
  const prevAltRef = useRef(altitude);

  useFrame((_, delta) => {
    const t = performance.now() * 0.001;
    const dt = Math.min(delta, 0.05); // cap to avoid huge jumps on tab-refocus

    // ---------- detect touchdown for landing jolt ----------
    const jolt = joltRef.current;
    if (phase === 'LANDING' && !jolt.triggered && prevAltRef.current > 80 && altitude <= 80) {
      jolt.active = true;
      jolt.triggered = true;
      jolt.value = -0.09; // sharp downward pitch spike
      jolt.velocity = 0.6; // spring recovery velocity
    }
    // Reset trigger when not landing
    if (phase !== 'LANDING') {
      jolt.triggered = false;
    }
    prevAltRef.current = altitude;

    // Damped spring for jolt recovery
    if (jolt.active) {
      jolt.value += jolt.velocity * dt;
      jolt.velocity -= jolt.value * 45 * dt; // spring constant
      jolt.velocity *= 0.92; // damping per frame
      if (Math.abs(jolt.value) < 0.001 && Math.abs(jolt.velocity) < 0.01) {
        jolt.active = false;
        jolt.value = 0;
        jolt.velocity = 0;
      }
    }

    // ---------- target pitch ----------
    const targetPitch = getTargetPitch(phase, altitude, speed);
    const smoothRate = getSmoothRate(phase);
    pitchRef.current += (targetPitch - pitchRef.current) * Math.min(1, dt * smoothRate);

    // ---------- target roll (banking) ----------
    const targetRoll = getTargetRoll(phase, t);
    const rollSmooth = phase === 'CRUISE' ? 0.3 : 0.6;
    rollRef.current += (targetRoll - rollRef.current) * Math.min(1, dt * rollSmooth);

    // ---------- turbulence ----------
    const turb = getTurbulence(phase, altitude, speed);
    const pitchNoise = noise(t * turb.freqScale) * turb.pitchAmp;
    const rollNoise = noise(t * turb.freqScale * 1.3 + 50) * turb.rollAmp;
    const yawNoise = noise(t * turb.freqScale * 0.8 + 100) * turb.yawAmp;

    // ---------- compose camera rotation ----------
    // Baseline downward bias: a window-seat view looks out and slightly down
    // so the wing and the cloud floor below sit clearly in frame.
    const VIEW_DOWN = 0.42;

    camera.rotation.order = 'YXZ';
    camera.rotation.x = pitchRef.current - VIEW_DOWN + pitchNoise + jolt.value;
    camera.rotation.z = rollRef.current + rollNoise;
    camera.rotation.y = yawNoise;
  });

  return null;
}
