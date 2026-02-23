import { useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Clone } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';

const BASE = import.meta.env.BASE_URL;
const T = (name: string) => BASE + `models/kenney-trains/${name}.glb`;

// Kenney Train Kit: a=front, b=middle, c=rear
const TRAIN_MODELS: Record<string, { front: string; car: string; rear: string; freight?: string[] } | null> = {
  local:      { front: T('train-electric-city-a'), car: T('train-electric-city-b'), rear: T('train-electric-city-c') },
  suburban:   { front: T('train-electric-square-a'), car: T('train-electric-square-b'), rear: T('train-electric-square-c') },
  express:    { front: T('train-electric-double-a'), car: T('train-electric-double-b'), rear: T('train-electric-double-c') },
  diesel:     { front: T('train-diesel-a'), car: T('train-diesel-b'), rear: T('train-diesel-c') },
  shinkansen: { front: T('train-electric-bullet-a'), car: T('train-electric-bullet-b'), rear: T('train-electric-bullet-c') },
  steam:      { front: T('train-locomotive-a'), car: T('train-locomotive-passenger-b'), rear: T('train-locomotive-c') },
  freight:    {
    front: T('train-diesel-box-a'),
    car: T('train-carriage-box'),
    rear: T('train-diesel-box-c'),
    freight: [T('train-carriage-coal'), T('train-carriage-container-blue'), T('train-carriage-container-red'), T('train-carriage-tank'), T('train-carriage-flatbed-wood')],
  },
};

// Preload all
const allPaths = new Set<string>();
for (const m of Object.values(TRAIN_MODELS)) {
  if (!m) continue;
  allPaths.add(m.front);
  allPaths.add(m.car);
  allPaths.add(m.rear);
  m.freight?.forEach(p => allPaths.add(p));
}
allPaths.forEach(p => useGLTF.preload(p));

function GLBTrainCar({ modelPath }: { modelPath: string }) {
  const { scene } = useGLTF(modelPath);
  return <Clone object={scene} scale={0.12} castShadow />;
}

function TrainMesh({ trainId }: { trainId: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const train = useGameStore(s => s.trains.get(trainId));
  const hour = useGameStore(s => s.gameTime.hour);
  const isNight = hour < 6 || hour >= 18;

  // Stable freight car model selection per train
  const freightModels = useMemo(() => {
    if (!train) return [];
    const models = TRAIN_MODELS[train.type];
    if (!models?.freight) return [];
    // Use train id hash for deterministic selection
    let hash = 0;
    for (let i = 0; i < train.id.length; i++) hash = ((hash << 5) - hash + train.id.charCodeAt(i)) | 0;
    return Array.from({ length: train.cars }, (_, i) => {
      if (i === 0) return models.front;
      if (i === train.cars - 1) return models.rear;
      return models.freight![Math.abs(hash + i * 7) % models.freight!.length];
    });
  }, [train?.id, train?.type, train?.cars]);

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
  if (!models) return null;

  const carSpacing = train.type === 'shinkansen' ? 0.22 : 0.24;
  const cars = train.cars;
  const hasFreight = freightModels.length > 0;

  return (
    <group ref={groupRef}>
      {Array.from({ length: cars }, (_, i) => {
        const isFront = i === 0;
        const isBack = i === cars - 1;
        const zPos = (i - (cars - 1) / 2) * carSpacing;

        let modelPath: string;
        if (hasFreight) {
          modelPath = freightModels[i];
        } else {
          modelPath = isFront ? models.front : isBack ? models.rear : models.car;
        }

        return (
          <group key={i} position={[0, 0, zPos]}>
            <Suspense fallback={null}>
              <GLBTrainCar modelPath={modelPath} />
            </Suspense>

            {isFront && (
              <>
                <mesh position={[0.04, 0.02, 0.1]}>
                  <sphereGeometry args={[0.012, 6, 6]} />
                  <meshStandardMaterial
                    color="#ffffee"
                    emissive={isNight ? '#ffffaa' : '#444400'}
                    emissiveIntensity={isNight ? 1.0 : 0.2}
                  />
                </mesh>
                <mesh position={[-0.04, 0.02, 0.1]}>
                  <sphereGeometry args={[0.012, 6, 6]} />
                  <meshStandardMaterial
                    color="#ffffee"
                    emissive={isNight ? '#ffffaa' : '#444400'}
                    emissiveIntensity={isNight ? 1.0 : 0.2}
                  />
                </mesh>
                {isNight && (
                  <pointLight position={[0, 0.03, 0.15]} color="#ffffcc" intensity={0.5} distance={3} decay={2} />
                )}
              </>
            )}

            {isBack && (
              <>
                <mesh position={[0.04, 0.02, -0.1]}>
                  <sphereGeometry args={[0.01, 6, 6]} />
                  <meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={0.6} />
                </mesh>
                <mesh position={[-0.04, 0.02, -0.1]}>
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
