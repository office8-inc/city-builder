import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import { isDiagonal } from '../game/constants.ts';
import type { TrackSegment, Signal } from '../game/types.ts';

// Shared geometries
const ballastGeo = new THREE.BoxGeometry(1.08, 0.06, 0.6);
const railGeo = new THREE.BoxGeometry(1.08, 0.025, 0.03);
const sleeperGeo = new THREE.BoxGeometry(0.09, 0.03, 0.45);
const pillarGeo = new THREE.BoxGeometry(0.1, 1.0, 0.1);

// Shared materials
const ballastMat = new THREE.MeshStandardMaterial({
  color: '#8a7a68',
  roughness: 0.92,
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
const pillarMat = new THREE.MeshStandardMaterial({
  color: '#888888',
  roughness: 0.5,
  metalness: 0.3,
});

// Number of sleepers per segment
const SLEEPER_COUNT = 7;
const sleeperPositions: number[] = [];
for (let i = 0; i < SLEEPER_COUNT; i++) {
  sleeperPositions.push(-0.45 + (i / (SLEEPER_COUNT - 1)) * 0.9);
}

function TrackSegmentMesh({ segment }: { segment: TrackSegment }) {
  const map = useGameStore(s => s.map);

  const { position, rotY, scale, isElevated } = useMemo(() => {
    const w1 = gridToWorld(segment.startX, segment.startZ);
    const w2 = gridToWorld(segment.endX, segment.endZ);
    const tile1 = map[segment.startX]?.[segment.startZ];
    const tile2 = map[segment.endX]?.[segment.endZ];
    const h1 = tile1 ? getTileWorldHeight(tile1) : 0;
    const h2 = tile2 ? getTileWorldHeight(tile2) : 0;
    const avgH = (h1 + h2) / 2;

    const diagonal = isDiagonal(segment.direction);
    const elevated = segment.elevation > 0;

    // Calculate rotation based on direction
    const dx = segment.endX - segment.startX;
    const dz = segment.endZ - segment.startZ;
    let rot = 0;
    if (dx === 0 && dz !== 0) {
      rot = Math.PI / 2; // N-S
    } else if (dx !== 0 && dz === 0) {
      rot = 0; // E-W
    } else if (dx > 0 && dz < 0) {
      rot = -Math.PI / 4; // NE
    } else if (dx > 0 && dz > 0) {
      rot = Math.PI / 4; // SE
    } else if (dx < 0 && dz > 0) {
      rot = 3 * Math.PI / 4; // SW
    } else if (dx < 0 && dz < 0) {
      rot = -3 * Math.PI / 4; // NW
    }

    const elevationOffset = elevated ? 1.0 : 0;

    return {
      position: [(w1.x + w2.x) / 2, avgH + 0.03 + elevationOffset, (w1.z + w2.z) / 2] as [number, number, number],
      rotY: rot,
      scale: diagonal ? [Math.SQRT2, 1, 1] as [number, number, number] : [1, 1, 1] as [number, number, number],
      isElevated: elevated,
    };
  }, [segment, map]);

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <group scale={scale}>
        {/* Ballast / gravel bed */}
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

      {/* Elevated pillars */}
      {isElevated && (
        <>
          <mesh geometry={pillarGeo} material={pillarMat} position={[-0.3, -0.5, 0]} castShadow />
          <mesh geometry={pillarGeo} material={pillarMat} position={[0.3, -0.5, 0]} castShadow />
        </>
      )}
    </group>
  );
}

const SIGNAL_COLORS: Record<Signal['state'], string> = {
  green: '#00ff44',
  yellow: '#ffcc00',
  red: '#ff2222',
};

function SignalMesh({ signal }: { signal: Signal }) {
  const map = useGameStore(s => s.map);
  const pos = useMemo(() => {
    const w = gridToWorld(signal.x, signal.z);
    const tile = map[signal.x]?.[signal.z];
    const h = tile ? getTileWorldHeight(tile) : 0;
    return [w.x + 0.3, h + 0.25, w.z + 0.3] as [number, number, number];
  }, [signal.x, signal.z, map]);

  const color = SIGNAL_COLORS[signal.state];

  return (
    <group position={pos}>
      {/* Pole */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.35, 4]} />
        <meshStandardMaterial color="#444" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Signal head */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[0.06, 0.12, 0.04]} />
        <meshStandardMaterial color="#222" roughness={0.7} />
      </mesh>
      {/* Light */}
      <mesh position={[0, 0.32, 0.025]}>
        <circleGeometry args={[0.02, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

export function Tracks() {
  const tracks = useGameStore(s => s.tracks);
  const signals = useGameStore(s => s.signals);
  const segments = useMemo(() => Array.from(tracks.values()), [tracks]);
  const signalArray = useMemo(() => Array.from(signals.values()), [signals]);

  return (
    <group>
      {segments.map(seg => (
        <TrackSegmentMesh key={seg.id} segment={seg} />
      ))}
      {signalArray.map(sig => (
        <SignalMesh key={sig.id} signal={sig} />
      ))}
    </group>
  );
}
