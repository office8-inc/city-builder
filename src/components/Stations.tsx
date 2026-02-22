import { useMemo } from 'react';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { Station } from '../game/types.ts';
import { Text } from '@react-three/drei';

function StationMesh({ station }: { station: Station }) {
  const map = useGameStore(s => s.map);
  const tracks = useGameStore(s => s.tracks);

  const { position, rotY } = useMemo(() => {
    const w = gridToWorld(station.x, station.z);
    const tile = map[station.x]?.[station.z];
    const h = tile ? getTileWorldHeight(tile) : 0;

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
      {/* Platform - raised beige rectangle */}
      <mesh position={[0, 0.05, 0.45]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.1, 0.55]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.8} />
      </mesh>

      {/* Platform edge line (yellow safety line) */}
      <mesh position={[0, 0.101, 0.2]}>
        <boxGeometry args={[1.35, 0.002, 0.04]} />
        <meshStandardMaterial color="#ddcc00" roughness={0.5} />
      </mesh>

      {/* Roof canopy - semi-transparent */}
      <mesh position={[0, 0.38, 0.45]} castShadow>
        <boxGeometry args={[1.2, 0.02, 0.5]} />
        <meshStandardMaterial
          color="#aabbcc"
          roughness={0.3}
          metalness={0.2}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Roof support pillars */}
      <mesh position={[-0.45, 0.22, 0.45]}>
        <boxGeometry args={[0.03, 0.3, 0.03]} />
        <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0.45, 0.22, 0.45]}>
        <boxGeometry args={[0.03, 0.3, 0.03]} />
        <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[-0.45, 0.22, 0.65]}>
        <boxGeometry args={[0.03, 0.3, 0.03]} />
        <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0.45, 0.22, 0.65]}>
        <boxGeometry args={[0.03, 0.3, 0.03]} />
        <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Station name sign billboard */}
      <group position={[0, 0.5, 0.7]}>
        {/* Sign board background */}
        <mesh>
          <boxGeometry args={[0.5, 0.14, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
        {/* Sign border */}
        <mesh position={[0, 0, 0.011]}>
          <boxGeometry args={[0.52, 0.16, 0.002]} />
          <meshStandardMaterial color="#2255aa" roughness={0.5} />
        </mesh>
        {/* Station name text */}
        <Text
          position={[0, 0.01, 0.02]}
          fontSize={0.06}
          color="#222222"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {station.name}
        </Text>
      </group>

      {/* Bench 1 */}
      <group position={[-0.25, 0.12, 0.55]}>
        {/* Seat */}
        <mesh>
          <boxGeometry args={[0.15, 0.015, 0.06]} />
          <meshStandardMaterial color="#6a5040" roughness={0.8} />
        </mesh>
        {/* Legs */}
        <mesh position={[-0.06, -0.02, 0]}>
          <boxGeometry args={[0.015, 0.04, 0.05]} />
          <meshStandardMaterial color="#555555" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0.06, -0.02, 0]}>
          <boxGeometry args={[0.015, 0.04, 0.05]} />
          <meshStandardMaterial color="#555555" roughness={0.5} metalness={0.4} />
        </mesh>
      </group>

      {/* Bench 2 */}
      <group position={[0.25, 0.12, 0.55]}>
        <mesh>
          <boxGeometry args={[0.15, 0.015, 0.06]} />
          <meshStandardMaterial color="#6a5040" roughness={0.8} />
        </mesh>
        <mesh position={[-0.06, -0.02, 0]}>
          <boxGeometry args={[0.015, 0.04, 0.05]} />
          <meshStandardMaterial color="#555555" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0.06, -0.02, 0]}>
          <boxGeometry args={[0.015, 0.04, 0.05]} />
          <meshStandardMaterial color="#555555" roughness={0.5} metalness={0.4} />
        </mesh>
      </group>
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
