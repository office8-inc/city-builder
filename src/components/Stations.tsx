import { useMemo } from 'react';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { Station } from '../game/types.ts';

function StationMesh({ station }: { station: Station }) {
  const map = useGameStore(s => s.map);
  const tracks = useGameStore(s => s.tracks);

  const { position, rotY } = useMemo(() => {
    const w = gridToWorld(station.x, station.z);
    const tile = map[station.x]?.[station.z];
    const h = tile ? getTileWorldHeight(tile) : 0;

    // Orient platform based on track direction at this station
    const trackId = station.connectedTracks[0];
    const track = trackId ? tracks.get(trackId) : null;
    const isEW = track ? track.startZ === track.endZ : true;

    return {
      position: [w.x, h, w.z] as [number, number, number],
      rotY: isEW ? 0 : Math.PI / 2,
    };
  }, [station, map, tracks]);

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Platform */}
      <mesh position={[0, 0.04, 0.45]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.08, 0.5]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.8} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 0.3, 0.45]} castShadow>
        <boxGeometry args={[0.8, 0.02, 0.4]} />
        <meshStandardMaterial color="#8b7355" roughness={0.7} />
      </mesh>
      {/* Roof support left */}
      <mesh position={[-0.3, 0.17, 0.45]}>
        <boxGeometry args={[0.03, 0.22, 0.03]} />
        <meshStandardMaterial color="#8b7355" roughness={0.7} />
      </mesh>
      {/* Roof support right */}
      <mesh position={[0.3, 0.17, 0.45]}>
        <boxGeometry args={[0.03, 0.22, 0.03]} />
        <meshStandardMaterial color="#8b7355" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function Stations() {
  const stations = useGameStore(s => s.stations);
  const stationArray = useMemo(() => Array.from(stations.values()), [stations]);

  if (stationArray.length === 0) return null;

  return (
    <group>
      {stationArray.map(station => (
        <StationMesh key={station.id} station={station} />
      ))}
    </group>
  );
}
