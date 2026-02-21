import { useMemo } from 'react';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { TrackSegment } from '../game/types.ts';

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
      {/* Ballast / roadbed */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.06, 0.4]} />
        <meshStandardMaterial color="#555555" roughness={0.9} />
      </mesh>
      {/* Rail 1 */}
      <mesh position={[0, 0.04, 0.12]} castShadow>
        <boxGeometry args={[1.0, 0.03, 0.03]} />
        <meshStandardMaterial color="#888888" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Rail 2 */}
      <mesh position={[0, 0.04, -0.12]} castShadow>
        <boxGeometry args={[1.0, 0.03, 0.03]} />
        <meshStandardMaterial color="#888888" roughness={0.3} metalness={0.6} />
      </mesh>
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
