import { useMemo } from 'react';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { Station, StationType } from '../game/types.ts';
import { Text } from '@react-three/drei';

function GroundSmallStation({ station, position, rotY }: { station: Station; position: [number, number, number]; rotY: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Platform */}
      <mesh position={[0, 0.05, 0.45]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.1, 0.55]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.8} />
      </mesh>
      {/* Yellow safety line */}
      <mesh position={[0, 0.101, 0.2]}>
        <boxGeometry args={[1.35, 0.002, 0.04]} />
        <meshStandardMaterial color="#ddcc00" roughness={0.5} />
      </mesh>
      {/* Roof canopy */}
      <mesh position={[0, 0.38, 0.45]} castShadow>
        <boxGeometry args={[1.2, 0.02, 0.5]} />
        <meshStandardMaterial color="#aabbcc" roughness={0.3} metalness={0.2} transparent opacity={0.7} />
      </mesh>
      {/* Roof pillars */}
      {[-0.45, 0.45].map(xp => (
        [0.45, 0.65].map(zp => (
          <mesh key={`${xp}-${zp}`} position={[xp, 0.22, zp]}>
            <boxGeometry args={[0.03, 0.3, 0.03]} />
            <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.4} />
          </mesh>
        ))
      ))}
      {/* Station name sign */}
      <group position={[0, 0.5, 0.7]}>
        <mesh>
          <boxGeometry args={[0.5, 0.14, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.011]}>
          <boxGeometry args={[0.52, 0.16, 0.002]} />
          <meshStandardMaterial color="#2255aa" roughness={0.5} />
        </mesh>
        <Text position={[0, 0.01, 0.02]} fontSize={0.06} color="#222222" anchorX="center" anchorY="middle" font={undefined}>
          {station.name}
        </Text>
      </group>
      {/* Benches */}
      {[-0.25, 0.25].map(xp => (
        <group key={xp} position={[xp, 0.12, 0.55]}>
          <mesh>
            <boxGeometry args={[0.15, 0.015, 0.06]} />
            <meshStandardMaterial color="#6a5040" roughness={0.8} />
          </mesh>
          {[-0.06, 0.06].map(lx => (
            <mesh key={lx} position={[lx, -0.02, 0]}>
              <boxGeometry args={[0.015, 0.04, 0.05]} />
              <meshStandardMaterial color="#555555" roughness={0.5} metalness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function GroundLargeStation({ station, position, rotY }: { station: Station; position: [number, number, number]; rotY: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Platform 1 */}
      <mesh position={[0, 0.05, 0.5]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.1, 0.5]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.8} />
      </mesh>
      {/* Platform 2 */}
      <mesh position={[0, 0.05, -0.5]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.1, 0.5]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.8} />
      </mesh>
      {/* Pedestrian bridge */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.3, 0.02, 1.2]} />
        <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Bridge pillars */}
      {[-0.5, 0.5].map(zp => (
        <mesh key={zp} position={[0, 0.3, zp]}>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* Roof */}
      <mesh position={[0, 0.45, 0.5]} castShadow>
        <boxGeometry args={[1.8, 0.02, 0.55]} />
        <meshStandardMaterial color="#aabbcc" roughness={0.3} metalness={0.2} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.45, -0.5]} castShadow>
        <boxGeometry args={[1.8, 0.02, 0.55]} />
        <meshStandardMaterial color="#aabbcc" roughness={0.3} metalness={0.2} transparent opacity={0.7} />
      </mesh>
      {/* Station name */}
      <group position={[0, 0.7, 0.7]}>
        <mesh>
          <boxGeometry args={[0.6, 0.16, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
        <Text position={[0, 0.01, 0.02]} fontSize={0.07} color="#222222" anchorX="center" anchorY="middle" font={undefined}>
          {station.name}
        </Text>
      </group>
    </group>
  );
}

function ElevatedStation({ station, position, rotY }: { station: Station; position: [number, number, number]; rotY: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Elevated pillars */}
      {[-0.6, 0.6].map(xp => (
        [-0.3, 0.3].map(zp => (
          <mesh key={`${xp}-${zp}`} position={[xp, 0.5, zp]} castShadow>
            <boxGeometry args={[0.12, 1.0, 0.12]} />
            <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.4} />
          </mesh>
        ))
      ))}
      {/* Elevated platform */}
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.1, 0.8]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.8} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[1.6, 0.02, 0.9]} />
        <meshStandardMaterial color="#6688aa" roughness={0.3} metalness={0.3} transparent opacity={0.7} />
      </mesh>
      {/* Station name */}
      <group position={[0, 1.6, 0.5]}>
        <mesh>
          <boxGeometry args={[0.6, 0.16, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
        <Text position={[0, 0.01, 0.02]} fontSize={0.07} color="#222222" anchorX="center" anchorY="middle" font={undefined}>
          {station.name}
        </Text>
      </group>
    </group>
  );
}

function TerminalStation({ station, position, rotY }: { station: Station; position: [number, number, number]; rotY: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Building body */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.6, 1.0]} />
        <meshStandardMaterial color="#ccbbaa" roughness={0.7} />
      </mesh>
      {/* Entrance */}
      <mesh position={[0, 0.2, 0.51]}>
        <boxGeometry args={[0.8, 0.4, 0.02]} />
        <meshStandardMaterial color="#445566" roughness={0.3} metalness={0.2} transparent opacity={0.5} />
      </mesh>
      {/* Platform area */}
      <mesh position={[0, 0.05, -0.3]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.1, 0.4]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.8} />
      </mesh>
      {/* Arched roof */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[2.2, 0.03, 1.2]} />
        <meshStandardMaterial color="#667788" roughness={0.3} metalness={0.4} transparent opacity={0.6} />
      </mesh>
      {/* Station name */}
      <group position={[0, 0.75, 0.6]}>
        <mesh>
          <boxGeometry args={[0.8, 0.2, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
        <Text position={[0, 0.01, 0.02]} fontSize={0.08} color="#222222" anchorX="center" anchorY="middle" font={undefined}>
          {station.name}
        </Text>
      </group>
    </group>
  );
}

function UndergroundStation({ station, position, rotY }: { station: Station; position: [number, number, number]; rotY: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Surface entrance box */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.3, 0.4]} />
        <meshStandardMaterial color="#aaaaaa" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Entrance opening */}
      <mesh position={[0, 0.1, 0.21]}>
        <boxGeometry args={[0.35, 0.2, 0.02]} />
        <meshStandardMaterial color="#223344" roughness={0.3} />
      </mesh>
      {/* Metro sign */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.15, 0.15, 0.15]} />
        <meshStandardMaterial color="#0044aa" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Station name */}
      <group position={[0, 0.55, 0.25]}>
        <mesh>
          <boxGeometry args={[0.5, 0.12, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
        <Text position={[0, 0.01, 0.02]} fontSize={0.05} color="#222222" anchorX="center" anchorY="middle" font={undefined}>
          {station.name}
        </Text>
      </group>
    </group>
  );
}

function DepotStation({ station, position, rotY }: { station: Station; position: [number, number, number]; rotY: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Shed */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.4, 0.8]} />
        <meshStandardMaterial color="#8a8070" roughness={0.8} />
      </mesh>
      {/* Shed roof (slightly angled appearance) */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[2.0, 0.03, 0.9]} />
        <meshStandardMaterial color="#556666" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Doors */}
      {[-0.4, 0.4].map(xp => (
        <mesh key={xp} position={[xp, 0.15, 0.41]}>
          <boxGeometry args={[0.5, 0.3, 0.02]} />
          <meshStandardMaterial color="#445555" roughness={0.5} />
        </mesh>
      ))}
      {/* Station name */}
      <group position={[0, 0.55, 0.5]}>
        <mesh>
          <boxGeometry args={[0.5, 0.12, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
        <Text position={[0, 0.01, 0.02]} fontSize={0.05} color="#222222" anchorX="center" anchorY="middle" font={undefined}>
          {station.name}
        </Text>
      </group>
    </group>
  );
}

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

    // For diagonal tracks, calculate proper rotation
    let rot = isEW ? 0 : Math.PI / 2;
    if (track) {
      const dx = track.endX - track.startX;
      const dz = track.endZ - track.startZ;
      if (dx !== 0 && dz !== 0) {
        rot = Math.atan2(dz, dx);
      }
    }

    return {
      position: [w.x, h, w.z] as [number, number, number],
      rotY: rot,
    };
  }, [station, map, tracks]);

  const sType: StationType = station.type || 'ground_small';

  switch (sType) {
    case 'ground_large':
      return <GroundLargeStation station={station} position={position} rotY={rotY} />;
    case 'elevated':
      return <ElevatedStation station={station} position={position} rotY={rotY} />;
    case 'terminal':
      return <TerminalStation station={station} position={position} rotY={rotY} />;
    case 'underground':
      return <UndergroundStation station={station} position={position} rotY={rotY} />;
    case 'depot':
      return <DepotStation station={station} position={position} rotY={rotY} />;
    default:
      return <GroundSmallStation station={station} position={position} rotY={rotY} />;
  }
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
