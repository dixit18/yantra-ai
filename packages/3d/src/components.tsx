'use client';
import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import gsap from 'gsap';
import {
  SUBSYSTEMS,
  statusLightIntensity,
  type CameraPreset,
  type StatusLight,
  type StoryStepDef,
  type Subsystem,
} from './story.js';

const BODY = '#59616c';
const BODY_DARK = '#3a4048';
const BELT = '#23272e';
const GROUND = '#e4ded1';

const LIGHT_COLOR: Record<StatusLight, string> = {
  amber: '#f08c00',
  red: '#e03131',
  green: '#2f9e44',
};

export interface MachineModelProps {
  selected: Subsystem | null;
  focus: Subsystem | null;
  beacon: StatusLight;
  screen: StatusLight;
  onSelect: (id: Subsystem | null) => void;
}

function useHoverCursor(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    const prev = document.body.style.cursor;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = prev;
    };
  }, [active]);
}

interface Tone {
  color: string;
  emissive: string;
  intensity: number;
}

const REST_TONE: Tone = { color: BODY, emissive: '#000000', intensity: 0 };

// Synthetic demo unit: parametric packaging-machine masses with named nodes.
// Real OEM models arrive as GLB (see README.md); node ids stay stable.
export function MachineModel({ selected, focus, beacon, screen, onSelect }: MachineModelProps) {
  const [hovered, setHovered] = useState<Subsystem | null>(null);
  useHoverCursor(hovered !== null);

  const tone = (id: Subsystem): Tone => {
    if (selected === id) {
      return { color: BODY, emissive: '#e8590c', intensity: 0.45 };
    }
    if (focus === id) {
      return { color: BODY, emissive: '#f08c00', intensity: 0.55 };
    }
    if (hovered === id) {
      return { color: BODY, emissive: '#8a94a0', intensity: 0.4 };
    }
    return REST_TONE;
  };

  const handlers = (id: Subsystem) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(id);
    },
    onPointerOut: () => {
      setHovered((h) => (h === id ? null : h));
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(selected === id ? null : id);
    },
  });

  const mat = (id: Subsystem) => {
    const t = tone(id);
    return (
      <meshStandardMaterial color={t.color} emissive={t.emissive} emissiveIntensity={t.intensity} />
    );
  };

  return (
    <group>
      {/* ground */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]}>
        <circleGeometry args={[2.6, 48]} />
        <meshStandardMaterial color={GROUND} />
      </mesh>

      {/* frame */}
      <group {...handlers('frame')}>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[3.6, 0.16, 1.7]} />
          {mat('frame')}
        </mesh>
        {(
          [
            [-1.6, -0.7],
            [1.6, -0.7],
            [-1.6, 0.7],
            [1.6, 0.7],
          ] as const
        ).map(([x, z]) => (
          <mesh key={`${x}:${z}`} position={[x, 0.18, z]}>
            <boxGeometry args={[0.12, 0.36, 0.12]} />
            <meshStandardMaterial color={BODY_DARK} />
          </mesh>
        ))}
      </group>

      {/* conveyor */}
      <group {...handlers('conveyor')}>
        <mesh position={[-0.3, 1.0, 0]}>
          <boxGeometry args={[2.2, 0.1, 0.9]} />
          <meshStandardMaterial color={BELT} />
        </mesh>
        {[-1.1, -0.3, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.92, 0]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.09, 0.09, 0.9, 20]} />
            {mat('conveyor')}
          </mesh>
        ))}
        {[-1.1, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.72, 0]}>
            <boxGeometry args={[0.1, 0.44, 0.8]} />
            <meshStandardMaterial color={BODY_DARK} />
          </mesh>
        ))}
      </group>

      {/* hopper */}
      <group {...handlers('hopper')}>
        <mesh position={[-1.05, 1.78, 0]} rotation-y={Math.PI / 4}>
          <cylinderGeometry args={[0.55, 0.16, 0.7, 4]} />
          {mat('hopper')}
        </mesh>
        <mesh position={[-1.05, 1.32, 0]}>
          <boxGeometry args={[0.18, 0.3, 0.18]} />
          <meshStandardMaterial color={BODY_DARK} />
        </mesh>
      </group>

      {/* control panel */}
      <group {...handlers('control-panel')}>
        <mesh position={[1.35, 1.25, -0.35]}>
          <boxGeometry args={[0.7, 1.5, 0.5]} />
          {mat('control-panel')}
        </mesh>
        <mesh position={[1.35, 1.55, -0.09]}>
          <planeGeometry args={[0.46, 0.3]} />
          <meshStandardMaterial
            color="#101216"
            emissive={LIGHT_COLOR[screen]}
            emissiveIntensity={statusLightIntensity(
              1.6,
              selected === 'control-panel',
              focus === 'control-panel',
            )}
          />
        </mesh>
      </group>

      {/* beacon */}
      <group {...handlers('beacon')}>
        <mesh position={[1.35, 2.14, -0.35]}>
          <cylinderGeometry args={[0.03, 0.03, 0.28, 12]} />
          <meshStandardMaterial color={BODY_DARK} />
        </mesh>
        <mesh position={[1.35, 2.34, -0.35]}>
          <sphereGeometry args={[0.09, 20, 16]} />
          <meshStandardMaterial
            color={LIGHT_COLOR[beacon]}
            emissive={LIGHT_COLOR[beacon]}
            emissiveIntensity={statusLightIntensity(2.4, selected === 'beacon', focus === 'beacon')}
          />
        </mesh>
      </group>

      {/* sensor */}
      <group {...handlers('sensor')}>
        <mesh position={[0.75, 1.0, 0.55]}>
          <boxGeometry args={[0.08, 1.0, 0.08]} />
          {mat('sensor')}
        </mesh>
        <mesh position={[0.75, 1.5, 0.55]}>
          <boxGeometry args={[0.2, 0.12, 0.12]} />
          {mat('sensor')}
        </mesh>
      </group>
    </group>
  );
}

interface ManualControls {
  target: { x: number; y: number; z: number };
  autoRotate: boolean;
  update: () => void;
}

function CameraRig({ preset }: { preset: CameraPreset }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ManualControls | null;
  const first = useRef(true);

  useEffect(() => {
    const [px, py, pz] = preset.position;
    const [tx, ty, tz] = preset.target;
    if (first.current || !controls) {
      first.current = false;
      camera.position.set(px, py, pz);
      if (controls) {
        controls.target.x = tx;
        controls.target.y = ty;
        controls.target.z = tz;
        controls.update();
      }
      return;
    }
    let cancelled = false;
    controls.autoRotate = false;
    const tweens = [
      gsap.to(camera.position, { x: px, y: py, z: pz, duration: 1.1, ease: 'power2.inOut' }),
      gsap.to(controls.target, {
        x: tx,
        y: ty,
        z: tz,
        duration: 1.1,
        ease: 'power2.inOut',
        onUpdate: () => {
          controls.update();
        },
        onComplete: () => {
          if (!cancelled) {
            controls.autoRotate = true;
          }
        },
      }),
    ];
    return () => {
      cancelled = true;
      tweens.forEach((t) => t.kill());
    };
  }, [preset, camera, controls]);

  return null;
}

export interface HeroSceneProps {
  step: StoryStepDef;
  selected: Subsystem | null;
  onSelect: (id: Subsystem | null) => void;
}

export function HeroScene({ step, selected, onSelect }: HeroSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: step.camera.position, fov: 38 }}
      data-testid="hero-canvas"
    >
      <color attach="background" args={['#faf7f1']} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[4, 6, 3]} intensity={2.0} />
      <directionalLight position={[-4, 3, -3]} intensity={0.4} />
      <CameraRig preset={step.camera} />
      <MachineModel
        selected={selected}
        focus={step.focusNode}
        beacon={step.beacon}
        screen={step.screen}
        onSelect={onSelect}
      />
      {/* Zoom disabled: wheel over the canvas must never trap page scroll. */}
      <OrbitControls
        makeDefault
        autoRotate
        autoRotateSpeed={0.7}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={0.5}
        maxPolarAngle={1.45}
      />
    </Canvas>
  );
}

export { SUBSYSTEMS };
export type { Subsystem };
