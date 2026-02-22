import { useMemo, Suspense } from 'react';
import { useGLTF, Clone, Text } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { Station, StationType } from '../game/types.ts';

const BASE = import.meta.env.BASE_URL;

// Station type -> GLB model path (null = omit)
const STATION_MODELS: Record<string, string | null> = {
  ground_small: BASE + 'models/kenney-buildings/platform_small.glb',
  ground_large: BASE + 'models/kenney-buildings/platform_long.glb',
  elevated:     BASE + 'models/kenney-buildings/platform_high.glb',
  terminal:     BASE + 'models/kenney-buildings/structure.glb',
  underground:  null, // Omit
  depot:        BASE + 'models/kenney-buildings/hangar_largeA.glb',
};

// Preload
Object.values(STATION_MODELS).filter((p): p is string => p !== null).forEach(p => useGLTF.preload(p));

function GLBStationMesh({ modelPath, position, rotY, scale }: {
  modelPath: string;
  position: [number, number, number];
  rotY: number;
  scale: number;
}) {
  const { scene } = useGLTF(modelPath);
  return (
    <Clone
      object={scene}
      position={position}
      rotation={[0, rotY, 0]}
      scale={scale}
      castShadow
      receiveShadow
    />
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
  const modelPath = STATION_MODELS[sType];

  if (!modelPath) return null; // Omit unsupported types (underground)

  const scale = sType === 'terminal' || sType === 'depot' ? 0.6 : 0.4;

  return (
    <group>
      <Suspense fallback={null}>
        <GLBStationMesh modelPath={modelPath} position={position} rotY={rotY} scale={scale} />
      </Suspense>
      {/* Station name sign */}
      <group position={[position[0], position[1] + 0.6, position[2]]}>
        <Text
          fontSize={0.06}
          color="#222222"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {station.name}
        </Text>
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
