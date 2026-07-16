import { useMemo, Suspense } from 'react';
import { useGLTF, Clone, Text } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import { tintUndergroundStatic } from '../utils/undergroundVisual.ts';
import type { Station, StationType } from '../game/types.ts';

const BASE = import.meta.env.BASE_URL;

// 地下線路と同じオフセット（Tracks.tsx参照）で地下ホームを沈める
const UNDERGROUND_PLATFORM_Y_OFFSET = -0.5;

// Station type -> GLB model path (null = 地上モデルを持たず、UndergroundEntranceを描画)
const STATION_MODELS: Record<string, string | null> = {
  ground_small: BASE + 'models/kenney-buildings/platform_small.glb',
  ground_large: BASE + 'models/kenney-buildings/platform_long.glb',
  elevated:     BASE + 'models/kenney-buildings/platform_high.glb',
  terminal:     BASE + 'models/kenney-buildings/structure.glb',
  underground:  null,
  depot:        BASE + 'models/kenney-buildings/hangar_largeA.glb',
};

// 地下鉄駅の地下ホーム表現には地上駅(小)の模型を流用し、半透明トーンで沈める
const UNDERGROUND_PLATFORM_MODEL = STATION_MODELS.ground_small!;

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

// 地下鉄駅: 地下には半透明のホーム、地上には小さな入口構造物（プロシージャル）を描画する
function UndergroundEntrance({ position, rotY, scale }: {
  position: [number, number, number];
  rotY: number;
  scale: number;
}) {
  const { scene } = useGLTF(UNDERGROUND_PLATFORM_MODEL);
  const undergroundScene = useMemo(() => tintUndergroundStatic(scene), [scene]);

  return (
    <group>
      {/* 地下ホーム（半透明・暗色） */}
      <Clone
        object={undergroundScene}
        position={[position[0], position[1] + UNDERGROUND_PLATFORM_Y_OFFSET, position[2]]}
        rotation={[0, rotY, 0]}
        scale={scale}
        castShadow
        receiveShadow
      />
      {/* 地上の入口構造物（プロシージャル: box + 階段風） */}
      <group position={position} rotation={[0, rotY, 0]}>
        <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.32, 0.18, 0.24]} />
          <meshStandardMaterial color="#2f5fa8" />
        </mesh>
        <mesh position={[0, 0.19, 0]} castShadow>
          <boxGeometry args={[0.38, 0.03, 0.3]} />
          <meshStandardMaterial color="#1c3f78" />
        </mesh>
        {[0, 1, 2, 3].map(i => (
          <mesh key={i} position={[0, 0.08 - i * 0.045, 0.16 + i * 0.09]} receiveShadow castShadow>
            <boxGeometry args={[0.26, 0.02, 0.09]} />
            <meshStandardMaterial color="#888888" />
          </mesh>
        ))}
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

    let rot = isEW ? 0 : Math.PI / 2;
    if (track) {
      const dx = track.endX - track.startX;
      const dz = track.endZ - track.startZ;
      if (dx !== 0 && dz !== 0) {
        rot = Math.atan2(dz, dx);
      }
    }

    return {
      position: [w.x, h + 0.05, w.z] as [number, number, number],
      rotY: rot,
    };
  }, [station, map, tracks]);

  const sType: StationType = station.type || 'ground_small';
  const modelPath = STATION_MODELS[sType];
  const scale = sType === 'terminal' || sType === 'depot' ? 0.6 : 0.4;

  return (
    <group>
      <Suspense fallback={null}>
        {modelPath ? (
          <GLBStationMesh modelPath={modelPath} position={position} rotY={rotY} scale={scale} />
        ) : (
          <UndergroundEntrance position={position} rotY={rotY} scale={scale} />
        )}
      </Suspense>
      {/* Station name sign（地下鉄駅も含め全種別で表示） */}
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
