import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { TrackSegment } from '../game/types.ts';

// Shared geometries for instancing-friendly rendering
const ballastGeo = new THREE.BoxGeometry(1.05, 0.05, 0.5);
const railGeo = new THREE.BoxGeometry(1.05, 0.025, 0.025);
const sleeperGeo = new THREE.BoxGeometry(0.08, 0.025, 0.38);

// Shared materials
const ballastMat = new THREE.MeshStandardMaterial({
  color: '#7a7060',
  roughness: 0.95,
  metalness: 0.0,
});
const railMat = new THREE.MeshStandardMaterial({
  color: '#707878',
  roughness: 0.25,
  metalness: 0.7,
});
const sleeperMat = new THREE.MeshStandardMaterial({
  color: '#5a4030',
  roughness: 0.9,
  metalness: 0.0,
});

// Number of sleepers per segment
const SLEEPER_COUNT = 7;
const sleeperPositions: number[] = [];
for (let i = 0; i < SLEEPER_COUNT; i++) {
  sleeperPositions.push(-0.45 + (i / (SLEEPER_COUNT - 1)) * 0.9);
}

function TrackSegmentMesh({ segment }: { segment: TrackSegment }) {
  const map = useGameStore(s => s.map);

  const { position, rotY } = useMemo(() => {
    const w1 = gridToWorld(segment.startX, segment.startZ);
    const w2 = gridToWorld(segment.endX, segment.endZ);
    const tile1 = map[segment.startX]?.[segment.startZ];
    const tile2 = map[segment.endX]?.[segment.endZ];
    const h1 = tile1 ? getTileWorldHeight(tile1) : 0;
    const h2 = tile2 ? getTileWorldHeight(tile2) : 0;
    const avgH = (h1 + h2) / 2;
    const isEW = segment.startZ === segment.endZ;

    return {
      position: [(w1.x + w2.x) / 2, avgH + 0.03, (w1.z + w2.z) / 2] as [number, number, number],
      rotY: isEW ? 0 : Math.PI / 2,
    };
  }, [segment, map]);

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Ballast / gravel bed - slightly raised */}
      <mesh geometry={ballastGeo} material={ballastMat} receiveShadow />

      {/* Sleepers / ties */}
      {sleeperPositions.map((xPos, i) => (
        <mesh
          key={i}
          geometry={sleeperGeo}
          material={sleeperMat}
          position={[xPos, 0.035, 0]}
          castShadow
          receiveShadow
        />
      ))}

      {/* Rail 1 */}
      <mesh
        geometry={railGeo}
        material={railMat}
        position={[0, 0.055, 0.12]}
        castShadow
      />
      {/* Rail 2 */}
      <mesh
        geometry={railGeo}
        material={railMat}
        position={[0, 0.055, -0.12]}
        castShadow
      />
    </group>
  );
}

export function Tracks() {
  const tracks = useGameStore(s => s.tracks);
  const segments = useMemo(() => Array.from(tracks.values()), [tracks]);

  if (segments.length === 0) return null;

  return (
    <group>
      {segments.map(seg => (
        <TrackSegmentMesh key={seg.id} segment={seg} />
      ))}
    </group>
  );
}
