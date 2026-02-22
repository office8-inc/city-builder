import { useMemo, Suspense } from 'react';
import { useGLTF, Clone } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import { GRID_SIZE } from '../game/constants.ts';

const BASE = import.meta.env.BASE_URL;

// Road model paths (kaykit-city)
const ROAD_MODELS = {
  straight: BASE + 'models/kaykit-city/road_straight.gltf',
  corner: BASE + 'models/kaykit-city/road_corner_curved.gltf',
  tsplit: BASE + 'models/kaykit-city/road_tsplit.gltf',
  junction: BASE + 'models/kaykit-city/road_junction.gltf',
};
const STREETLIGHT_MODEL = BASE + 'models/kaykit-city/streetlight.gltf';

// Preload all road models
Object.values(ROAD_MODELS).forEach(p => useGLTF.preload(p));
useGLTF.preload(STREETLIGHT_MODEL);

type RoadShape = 'straight' | 'corner' | 'tsplit' | 'junction';

interface RoadTileInfo {
  x: number;
  z: number;
  h: number;
  shape: RoadShape;
  rotY: number;
  modelPath: string;
}

function computeRoadConnectivity(
  x: number, z: number, map: ReturnType<typeof useGameStore.getState>['map']
): { shape: RoadShape; rotY: number } {
  const hasRoad = (nx: number, nz: number) => {
    if (nx < 0 || nx >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE) return false;
    return map[nx][nz].roadLevel > 0;
  };

  const N = hasRoad(x, z - 1);
  const S = hasRoad(x, z + 1);
  const E = hasRoad(x + 1, z);
  const W = hasRoad(x - 1, z);
  const count = [N, S, E, W].filter(Boolean).length;

  switch (count) {
    case 0:
    case 1: {
      if (N || S) return { shape: 'straight', rotY: 0 };
      return { shape: 'straight', rotY: Math.PI / 2 };
    }
    case 2: {
      if (N && S) return { shape: 'straight', rotY: 0 };
      if (E && W) return { shape: 'straight', rotY: Math.PI / 2 };
      if (N && E) return { shape: 'corner', rotY: Math.PI / 2 };
      if (E && S) return { shape: 'corner', rotY: Math.PI };
      if (S && W) return { shape: 'corner', rotY: -Math.PI / 2 };
      if (W && N) return { shape: 'corner', rotY: 0 };
      return { shape: 'straight', rotY: 0 };
    }
    case 3: {
      if (!N) return { shape: 'tsplit', rotY: Math.PI };
      if (!S) return { shape: 'tsplit', rotY: 0 };
      if (!E) return { shape: 'tsplit', rotY: -Math.PI / 2 };
      if (!W) return { shape: 'tsplit', rotY: Math.PI / 2 };
      return { shape: 'tsplit', rotY: 0 };
    }
    case 4:
      return { shape: 'junction', rotY: 0 };
    default:
      return { shape: 'straight', rotY: 0 };
  }
}

function RoadTile({ tile }: { tile: RoadTileInfo }) {
  const { scene } = useGLTF(tile.modelPath);
  return (
    <Clone
      object={scene}
      position={[tile.x, tile.h + 0.01, tile.z]}
      rotation={[0, tile.rotY, 0]}
      scale={0.5}
      receiveShadow
    />
  );
}

function StreetLight({ position, isNight }: { position: [number, number, number]; isNight: boolean }) {
  const { scene } = useGLTF(STREETLIGHT_MODEL);
  return (
    <group position={position}>
      <Clone object={scene} scale={0.3} castShadow />
      {isNight && (
        <pointLight
          position={[0, 0.4, 0]}
          color="#ffeecc"
          intensity={0.3}
          distance={2.5}
          decay={2}
        />
      )}
    </group>
  );
}

export function Roads() {
  const map = useGameStore(s => s.map);
  const buildings = useGameStore(s => s.buildings);
  const hour = useGameStore(s => s.gameTime.hour);
  const isNight = hour < 6 || hour >= 18;

  const { roadTiles, streetLights } = useMemo(() => {
    const tiles: RoadTileInfo[] = [];
    const lights: [number, number, number][] = [];

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        if (tile.roadLevel > 0 && !tile.buildingId && !tile.stationId && tile.trackIds.length === 0 && !tile.subsidiaryId) {
          const w = gridToWorld(x, z);
          const h = getTileWorldHeight(tile);
          const { shape, rotY } = computeRoadConnectivity(x, z, map);

          tiles.push({
            x: w.x, z: w.z, h,
            shape, rotY,
            modelPath: ROAD_MODELS[shape],
          });

          // Street lights every ~4 tiles on main roads
          if (tile.roadLevel >= 2 && (x + z) % 4 === 0) {
            lights.push([w.x + 0.4, h, w.z + 0.4]);
          }
        }
      }
    }
    return { roadTiles: tiles, streetLights: lights };
  }, [map, buildings]);

  if (roadTiles.length === 0) return null;

  return (
    <Suspense fallback={null}>
      <group>
        {roadTiles.map((tile, i) => (
          <RoadTile key={i} tile={tile} />
        ))}
        {streetLights.map((pos, i) => (
          <StreetLight key={`sl${i}`} position={pos} isNight={isNight} />
        ))}
      </group>
    </Suspense>
  );
}
