import { useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Clone } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
// Train vehicle types are defined by keys in TRAIN_MODELS

const BASE = import.meta.env.BASE_URL;

// Train model mapping (monorail models)
const TRAIN_MODELS: Record<string, { front: string; car: string; rear: string } | null> = {
  local:      { front: BASE + 'models/kenney-monorail/monorail_trainFront.glb', car: BASE + 'models/kenney-monorail/monorail_trainPassenger.glb', rear: BASE + 'models/kenney-monorail/monorail_trainEnd.glb' },
  suburban:   { front: BASE + 'models/kenney-monorail/monorail_trainFront.glb', car: BASE + 'models/kenney-monorail/monorail_trainPassenger.glb', rear: BASE + 'models/kenney-monorail/monorail_trainEnd.glb' },
  express:    { front: BASE + 'models/kenney-monorail/monorail_trainFront.glb', car: BASE + 'models/kenney-monorail/monorail_trainPassenger.glb', rear: BASE + 'models/kenney-monorail/monorail_trainEnd.glb' },
  shinkansen: { front: BASE + 'models/kenney-monorail/monorail_trainFront.glb', car: BASE + 'models/kenney-monorail/monorail_trainPassenger.glb', rear: BASE + 'models/kenney-monorail/monorail_trainEnd.glb' },
  steam:      null,
  freight:    { front: BASE + 'models/kenney-monorail/monorail_trainFront.glb', car: BASE + 'models/kenney-monorail/monorail_trainCargo.glb', rear: BASE + 'models/kenney-monorail/monorail_trainFlat.glb' },
  diesel:     { front: BASE + 'models/kenney-monorail/monorail_trainBox.glb', car: BASE + 'models/kenney-monorail/monorail_trainPassenger.glb', rear: BASE + 'models/kenney-monorail/monorail_trainEnd.glb' },
};

// Preload all train models
const trainModelPaths = new Set<string>();
for (const m of Object.values(TRAIN_MODELS)) {
  if (m) { trainModelPaths.add(m.front); trainModelPaths.add(m.car); trainModelPaths.add(m.rear); }
}
trainModelPaths.forEach(p => useGLTF.preload(p));

// Single GLB train car
function GLBTrainCar({ modelPath }: { modelPath: string }) {
  const { scene } = useGLTF(modelPath);
  return <Clone object={scene} scale={0.1} castShadow />;
}

function TrainMesh({ trainId }: { trainId: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const train = useGameStore(s => s.trains.get(trainId));
  const hour = useGameStore(s => s.gameTime.hour);
  const isNight = hour < 6 || hour >= 18;

  useFrame(() => {
    const { trains, tracks, map } = useGameStore.getState();
    const t = trains.get(trainId);
    if (!t || !groupRef.current) return;
    const segment = tracks.get(t.currentSegmentId);
    if (!segment) return;
    const w1 = gridToWorld(segment.startX, segment.startZ);
    const w2 = gridToWorld(segment.endX, segment.endZ);
    const tile1 = map[segment.startX]?.[segment.startZ];
    const tile2 = map[segment.endX]?.[segment.endZ];
    const h1 = tile1 ? getTileWorldHeight(tile1) : 0;
    const h2 = tile2 ? getTileWorldHeight(tile2) : 0;
    const p = t.positionOnSegment;
    groupRef.current.position.set(
      w1.x + (w2.x - w1.x) * p,
      h1 + (h2 - h1) * p + 0.15,
      w1.z + (w2.z - w1.z) * p
    );
    const dx = w2.x - w1.x;
    const dz = w2.z - w1.z;
    const angle = Math.atan2(dx, dz);
    groupRef.current.rotation.y = t.direction === 1 ? angle : angle + Math.PI;
  });

  if (!train) return null;

  const models = TRAIN_MODELS[train.type];
  if (!models) return null; // Omit unsupported train types (steam)

  const carSpacing = train.type === 'shinkansen' ? 0.22 : 0.24;
  const cars = train.cars;

  return (
    <group ref={groupRef}>
      {Array.from({ length: cars }, (_, i) => {
        const isFront = i === 0;
        const isBack = i === cars - 1;
        const zPos = (i - (cars - 1) / 2) * carSpacing;
        const modelPath = isFront ? models.front : isBack ? models.rear : models.car;

        return (
          <group key={i} position={[0, 0, zPos]}>
            <Suspense fallback={null}>
              <GLBTrainCar modelPath={modelPath} />
            </Suspense>

            {/* Headlights on front car */}
            {isFront && (
              <>
                <mesh position={[0.04, 0.01, 0.09]}>
                  <sphereGeometry args={[0.012, 6, 6]} />
                  <meshStandardMaterial
                    color="#ffffee"
                    emissive={isNight ? '#ffffaa' : '#444400'}
                    emissiveIntensity={isNight ? 1.0 : 0.2}
                  />
                </mesh>
                <mesh position={[-0.04, 0.01, 0.09]}>
                  <sphereGeometry args={[0.012, 6, 6]} />
                  <meshStandardMaterial
                    color="#ffffee"
                    emissive={isNight ? '#ffffaa' : '#444400'}
                    emissiveIntensity={isNight ? 1.0 : 0.2}
                  />
                </mesh>
                {isNight && (
                  <pointLight position={[0, 0.02, 0.15]} color="#ffffcc" intensity={0.5} distance={3} decay={2} />
                )}
              </>
            )}

            {/* Tail lights on back car */}
            {isBack && (
              <>
                <mesh position={[0.04, 0.01, -0.09]}>
                  <sphereGeometry args={[0.01, 6, 6]} />
                  <meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={0.6} />
                </mesh>
                <mesh position={[-0.04, 0.01, -0.09]}>
                  <sphereGeometry args={[0.01, 6, 6]} />
                  <meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={0.6} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function Trains() {
  const trains = useGameStore(s => s.trains);
  const trainIds = useMemo(() => Array.from(trains.keys()), [trains]);

  if (trainIds.length === 0) return null;

  return (
    <group>
      {trainIds.map(id => (
        <TrainMesh key={id} trainId={id} />
      ))}
    </group>
  );
}
