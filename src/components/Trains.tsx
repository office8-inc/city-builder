import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';

function TrainMesh({ trainId }: { trainId: string }) {
  const groupRef = useRef<THREE.Group>(null);

  // Static data for initial render (cars, color)
  const train = useGameStore(s => s.trains.get(trainId));

  // Animate position every frame via imperative update (no React re-render needed)
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

    const isEW = segment.startZ === segment.endZ;
    groupRef.current.rotation.y = isEW ? 0 : Math.PI / 2;
  });

  if (!train) return null;

  return (
    <group ref={groupRef}>
      {Array.from({ length: train.cars }, (_, i) => (
        <mesh key={i} position={[(i - (train.cars - 1) / 2) * 0.22, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.12, 0.16]} />
          <meshStandardMaterial color={train.color} />
        </mesh>
      ))}
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
