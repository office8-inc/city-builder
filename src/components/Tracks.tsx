import { useMemo, Suspense } from 'react';
import { useGLTF, Clone } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import { isDiagonal } from '../game/constants.ts';
import type { Signal, Direction } from '../game/types.ts';

const BASE = import.meta.env.BASE_URL;

// Kenney Train Kit track models
const TRACK_STRAIGHT = BASE + 'models/kenney-trains/railroad-straight.glb';
const TRACK_CURVE = BASE + 'models/kenney-trains/railroad-curve.glb';
// Rails-only for elevated sections
const RAIL_STRAIGHT = BASE + 'models/kenney-trains/railroad-rail-straight.glb';
const RAIL_CURVE = BASE + 'models/kenney-trains/railroad-rail-curve.glb';
// 高架線路の支柱
const PILLAR_MODEL = BASE + 'models/kenney-props/supports_high.glb';
// 信号機はプロシージャル（Kenneyに適切な鉄道信号モデルがないため）

useGLTF.preload(TRACK_STRAIGHT);
useGLTF.preload(TRACK_CURVE);
useGLTF.preload(RAIL_STRAIGHT);
useGLTF.preload(RAIL_CURVE);
useGLTF.preload(PILLAR_MODEL);


interface TrackTileData {
  cx: number;
  cy: number;
  cz: number;
  rotY: number;
  scaleX: number;
  isElevated: boolean;
  isCurve: boolean;
}

function computeSegmentData(
  startX: number, startZ: number, endX: number, endZ: number,
  direction: Direction, elevation: number, trackType: string, map: any,
): TrackTileData {
  const w1 = gridToWorld(startX, startZ);
  const w2 = gridToWorld(endX, endZ);
  const tile1 = map[startX]?.[startZ];
  const tile2 = map[endX]?.[endZ];
  const h1 = tile1 ? getTileWorldHeight(tile1) : 0;
  const h2 = tile2 ? getTileWorldHeight(tile2) : 0;
  const avgH = (h1 + h2) / 2;
  const diagonal = isDiagonal(direction);
  const elevated = elevation > 0;

  const dx = endX - startX;
  const dz = endZ - startZ;
  let rot = 0;
  if (dx === 0 && dz !== 0) rot = Math.PI / 2;
  else if (dx !== 0 && dz === 0) rot = 0;
  else if (dx > 0 && dz < 0) rot = -Math.PI / 4;
  else if (dx > 0 && dz > 0) rot = Math.PI / 4;
  else if (dx < 0 && dz > 0) rot = 3 * Math.PI / 4;
  else if (dx < 0 && dz < 0) rot = -3 * Math.PI / 4;

  const elevationOffset = elevated ? 1.0 : 0;

  return {
    cx: (w1.x + w2.x) / 2,
    cy: avgH + 0.02 + elevationOffset,
    cz: (w1.z + w2.z) / 2,
    rotY: rot,
    scaleX: diagonal ? Math.SQRT2 : 1,
    isElevated: elevated,
    isCurve: trackType === 'curve',
  };
}

function TrackModel({ data }: { data: TrackTileData }) {
  const modelPath = data.isCurve
    ? (data.isElevated ? RAIL_CURVE : TRACK_CURVE)
    : (data.isElevated ? RAIL_STRAIGHT : TRACK_STRAIGHT);
  const { scene } = useGLTF(modelPath);

  // Model BBox: X[-0.5,0.5] Y[-1,-0.9] Z[0,4]
  // Y origin is at -1 (not 0), so we offset position.y by scaleY*1.0 to bring
  // the model bottom to ground level. Z offset centers the scaled model.
  const zScale = data.scaleX * 0.25;

  return (
    <group position={[data.cx, data.cy + 0.02, data.cz]} rotation={[0, data.rotY + Math.PI / 2, 0]}>
      <Clone
        object={scene}
        position={[0, 1.2, -2 * zScale]}
        scale={[0.55, 1.2, zScale]}
        castShadow
        receiveShadow
      />
    </group>
  );
}

function PillarModel({ position, rotY }: { position: [number, number, number]; rotY: number }) {
  const { scene } = useGLTF(PILLAR_MODEL);
  return (
    <Clone
      object={scene}
      position={position}
      rotation={[0, rotY, 0]}
      scale={[0.12, 0.5, 0.12]}
      castShadow
    />
  );
}

function ElevatedPillars({ pillars }: { pillars: { x: number; y: number; z: number; rotY: number }[] }) {
  if (pillars.length === 0) return null;
  return (
    <>
      {pillars.map((p, i) => (
        <PillarModel key={i} position={[p.x, p.y, p.z]} rotY={p.rotY} />
      ))}
    </>
  );
}

function TrackInstances() {
  const tracks = useGameStore(s => s.tracks);
  const map = useGameStore(s => s.map);

  const { trackData, pillars } = useMemo(() => {
    const segments = Array.from(tracks.values());
    const data = segments.map(seg => computeSegmentData(
      seg.startX, seg.startZ, seg.endX, seg.endZ,
      seg.direction, seg.elevation, seg.type, map,
    ));
    const pillarList: { x: number; y: number; z: number; rotY: number }[] = [];
    for (const d of data) {
      if (!d.isElevated) continue;
      for (const localX of [-0.3, 0.3]) {
        const cosR = Math.cos(d.rotY);
        const sinR = Math.sin(d.rotY);
        pillarList.push({
          x: d.cx + localX * cosR * d.scaleX,
          y: d.cy - 0.5,
          z: d.cz + localX * sinR * d.scaleX,
          rotY: d.rotY,
        });
      }
    }
    return { trackData: data, pillars: pillarList };
  }, [tracks, map]);

  if (trackData.length === 0) return null;

  return (
    <Suspense fallback={null}>
      <group>
        {trackData.map((d, i) => (
          <TrackModel key={i} data={d} />
        ))}
        <ElevatedPillars pillars={pillars} />
      </group>
    </Suspense>
  );
}

const SIGNAL_COLORS: Record<Signal['state'], string> = {
  green: '#00ff44',
  yellow: '#ffcc00',
  red: '#ff2222',
};

// プロシージャル鉄道信号機
function SignalMesh({ signal }: { signal: Signal }) {
  const map = useGameStore(s => s.map);
  const pos = useMemo(() => {
    const w = gridToWorld(signal.x, signal.z);
    const tile = map[signal.x]?.[signal.z];
    const h = tile ? getTileWorldHeight(tile) : 0;
    return [w.x + 0.3, h, w.z + 0.3] as [number, number, number];
  }, [signal.x, signal.z, map]);

  const color = SIGNAL_COLORS[signal.state];

  return (
    <group position={pos}>
      {/* 支柱 */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      {/* 信号灯本体 */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.06, 0.12, 0.04]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* 信号灯 */}
      <mesh position={[0, 0.5, 0.025]}>
        <circleGeometry args={[0.025, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

export function Tracks() {
  const signals = useGameStore(s => s.signals);
  const signalArray = useMemo(() => Array.from(signals.values()), [signals]);

  return (
    <group>
      <TrackInstances />
      {signalArray.map(sig => (
        <SignalMesh key={sig.id} signal={sig} />
      ))}
    </group>
  );
}
