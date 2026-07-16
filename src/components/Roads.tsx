import { useMemo, Suspense } from 'react';
import { useGLTF, Clone } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import { GRID_SIZE } from '../game/constants.ts';

const BASE = import.meta.env.BASE_URL;

// Kenney City Builder road models (GLB)
const ROAD_MODELS = {
  straight: BASE + 'models/road-straight.glb',
  straightLights: BASE + 'models/road-straight-lightposts.glb',
  corner: BASE + 'models/road-corner.glb',
  tsplit: BASE + 'models/road-split.glb',
  junction: BASE + 'models/road-intersection.glb',
};

// Preload all road models
Object.values(ROAD_MODELS).forEach(p => useGLTF.preload(p));

type RoadShape = 'straight' | 'straightLights' | 'corner' | 'tsplit' | 'junction';

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
      return { shape: 'junction', rotY: 0 };
    case 1: {
      if (N) return { shape: 'straight', rotY: 0 };
      if (S) return { shape: 'straight', rotY: 0 };
      if (E) return { shape: 'straight', rotY: Math.PI / 2 };
      if (W) return { shape: 'straight', rotY: Math.PI / 2 };
      return { shape: 'straight', rotY: 0 };
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
      position={[tile.x, tile.h + 0.05, tile.z]}
      rotation={[0, tile.rotY, 0]}
      scale={1.0}
      receiveShadow
    />
  );
}

function RoadLights({ positions, isNight }: { positions: [number, number, number][]; isNight: boolean }) {
  if (!isNight || positions.length === 0) return null;
  return (
    <>
      {positions.map((pos, i) => (
        <pointLight
          key={i}
          position={pos}
          color="#ffeecc"
          intensity={1.5}
          distance={6}
          decay={2}
        />
      ))}
    </>
  );
}

export function Roads() {
  const map = useGameStore(s => s.map);
  const hour = useGameStore(s => s.gameTime.hour);
  const isNight = hour < 6 || hour >= 18;

  const { roadTiles, lightPositions } = useMemo(() => {
    const tiles: RoadTileInfo[] = [];
    const lights: [number, number, number][] = [];

    // Pre-compute smoothed road heights
    const roadHeights: Map<string, number> = new Map();
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        if (tile.roadLevel > 0) {
          let sum = getTileWorldHeight(tile);
          let cnt = 1;
          for (const [nx, nz] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]) {
            if (nx >= 0 && nx < GRID_SIZE && nz >= 0 && nz < GRID_SIZE && map[nx][nz].roadLevel > 0) {
              sum += getTileWorldHeight(map[nx][nz]);
              cnt++;
            }
          }
          roadHeights.set(`${x},${z}`, sum / cnt);
        }
      }
    }

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        // 建物・駅・子会社があるタイルでも道路を描画（接続の途切れを防ぐ）
        if (tile.roadLevel > 0 && tile.trackIds.length === 0) {
          const w = gridToWorld(x, z);
          const h = roadHeights.get(`${x},${z}`) ?? getTileWorldHeight(tile);
          const connectivity = computeRoadConnectivity(x, z, map);
          const rotY = connectivity.rotY;
          let shape = connectivity.shape;

          // Use lightpost variant for every 4th straight tile
          const useLights = shape === 'straight' && (x + z) % 4 === 0;
          if (useLights) {
            shape = 'straightLights';
            lights.push([w.x, h + 0.45, w.z]);
          }

          tiles.push({
            x: w.x, z: w.z, h,
            shape, rotY,
            modelPath: ROAD_MODELS[shape],
          });
        }
      }
    }
    return { roadTiles: tiles, lightPositions: lights };
  }, [map]);

  if (roadTiles.length === 0) return null;

  return (
    <Suspense fallback={null}>
      <group>
        {roadTiles.map((tile, i) => (
          <RoadTile key={i} tile={tile} />
        ))}
        <RoadLights positions={lightPositions} isNight={isNight} />
      </group>
    </Suspense>
  );
}
