import { useMemo, useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, Clone } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { Subsidiary } from '../game/types.ts';

const BASE = import.meta.env.BASE_URL;

// Subsidiary type -> GLB model path — Kenneyのみ使用
const SUBSIDIARY_MODELS: Record<string, string | null> = {
  factory:           BASE + 'models/kenney-buildings/hangar_roundB.glb',
  depot:             BASE + 'models/kenney-buildings/hangar_largeB.glb',
  hotel:             BASE + 'models/kenney-commercial/building-skyscraper-a.glb',
  department_store:  BASE + 'models/kenney-commercial/building-skyscraper-b.glb',
  power_plant:       BASE + 'models/kenney-buildings/structure_detailed.glb',
  material_yard:     BASE + 'models/kenney-buildings/hangar_smallB.glb',
  warehouse:         BASE + 'models/kenney-buildings/hangar_smallA.glb',
  resort_hotel:      BASE + 'models/kenney-commercial/building-skyscraper-c.glb',
  convenience_store: BASE + 'models/kenney-commercial/building-a.glb',
  supermarket:       BASE + 'models/kenney-commercial/building-b.glb',
  office_building:   BASE + 'models/kenney-commercial/building-skyscraper-d.glb',
  apartment:         BASE + 'models/kenney-suburban/building-type-k.glb',
  amusement_park:    BASE + 'models/kenney-buildings/gate_complex.glb',
  stadium:           BASE + 'models/kenney-buildings/hangar_roundGlass.glb',
  broadcast_tower:   BASE + 'models/kenney-props/satelliteDish_large.glb',
};

// Preload all non-null models
const subModelPaths = Object.values(SUBSIDIARY_MODELS).filter((p): p is string => p !== null);
subModelPaths.forEach(p => useGLTF.preload(p));

// Smoke particles (procedural - kept as particle effect)
function SmokeParticles({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 8;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      offset: i * 0.4,
      x: (Math.random() - 0.5) * 0.05,
      z: (Math.random() - 0.5) * 0.05,
      speed: 0.1 + Math.random() * 0.05,
    })),
  []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const age = ((t * p.speed + p.offset) % 1.6);
      dummy.position.set(position[0] + p.x * age, position[1] + age * 0.5, position[2] + p.z * age);
      const scale = 0.02 + age * 0.03;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color="#aaaaaa" transparent opacity={0.35} />
    </instancedMesh>
  );
}

function useSubPosition(sub: Subsidiary): [number, number, number] {
  const map = useGameStore(s => s.map);
  return useMemo(() => {
    const w = gridToWorld(sub.x, sub.z);
    const tile = map[sub.x]?.[sub.z];
    const h = tile ? getTileWorldHeight(tile) : 0;
    return [w.x, h, w.z] as [number, number, number];
  }, [sub, map]);
}

function GLBSubMesh({ sub, modelPath }: { sub: Subsidiary; modelPath: string }) {
  const pos = useSubPosition(sub);
  const { scene } = useGLTF(modelPath);

  // Kenneyモデルはデフォルトスケール1.0で使用
  const scale = 1.0;

  const hasSmoke = sub.type === 'factory' || sub.type === 'power_plant';

  return (
    <group position={pos}>
      <Clone object={scene} scale={scale} castShadow receiveShadow />
      {hasSmoke && <SmokeParticles position={[pos[0] + 0.2, pos[1] + 0.5, pos[2]]} />}
    </group>
  );
}

export function Subsidiaries() {
  const subsidiaries = useGameStore(s => s.subsidiaries);
  const subArray = useMemo(() => Array.from(subsidiaries.values()), [subsidiaries]);

  if (subArray.length === 0) return null;

  return (
    <Suspense fallback={null}>
      <group>
        {subArray.map(sub => {
          const modelPath = SUBSIDIARY_MODELS[sub.type];
          if (!modelPath) return null; // Omit unsupported types
          return <GLBSubMesh key={sub.id} sub={sub} modelPath={modelPath} />;
        })}
      </group>
    </Suspense>
  );
}
