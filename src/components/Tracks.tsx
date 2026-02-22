import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import { isDiagonal } from '../game/constants.ts';
import type { Signal, Direction } from '../game/types.ts';

// Shared geometries
const ballastGeo = new THREE.BoxGeometry(1.08, 0.06, 0.6);
const railGeo = new THREE.BoxGeometry(1.08, 0.025, 0.03);
const sleeperGeo = new THREE.BoxGeometry(0.09, 0.03, 0.45);
const pillarGeo = new THREE.BoxGeometry(0.1, 1.0, 0.1);

// Load real textures for tracks
const BASE = import.meta.env.BASE_URL;
const texLoader = new THREE.TextureLoader();
function loadTiledTexture(path: string): THREE.Texture {
  const tex = texLoader.load(BASE + path.replace(/^\//, ''));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// Shared materials with real textures
const ballastMat = new THREE.MeshStandardMaterial({
  color: '#9a8a78',
  map: loadTiledTexture('/textures/gravel-color.jpg'),
  normalMap: loadTiledTexture('/textures/gravel-normal.jpg'),
  normalScale: new THREE.Vector2(0.3, 0.3),
  roughnessMap: loadTiledTexture('/textures/gravel-roughness.jpg'),
  roughness: 0.92,
  metalness: 0.0,
});
const railMat = new THREE.MeshStandardMaterial({
  color: '#808888',
  map: loadTiledTexture('/textures/metal-color.jpg'),
  normalMap: loadTiledTexture('/textures/metal-normal.jpg'),
  normalScale: new THREE.Vector2(0.2, 0.2),
  roughness: 0.25,
  metalness: 0.7,
});
const sleeperMat = new THREE.MeshStandardMaterial({
  color: '#5a4030',
  map: loadTiledTexture('/textures/wood-color.jpg'),
  normalMap: loadTiledTexture('/textures/wood-normal.jpg'),
  normalScale: new THREE.Vector2(0.25, 0.25),
  roughness: 0.9,
  metalness: 0.0,
});
const pillarMat = new THREE.MeshStandardMaterial({
  color: '#888888',
  map: loadTiledTexture('/textures/concrete-color.jpg'),
  normalMap: loadTiledTexture('/textures/concrete-normal.jpg'),
  normalScale: new THREE.Vector2(0.2, 0.2),
  roughness: 0.5,
  metalness: 0.3,
});

const SLEEPER_COUNT = 7;
const sleeperOffsets: number[] = [];
for (let i = 0; i < SLEEPER_COUNT; i++) {
  sleeperOffsets.push(-0.45 + (i / (SLEEPER_COUNT - 1)) * 0.9);
}

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

function computeSegmentTransform(
  startX: number, startZ: number, endX: number, endZ: number,
  direction: Direction, elevation: number, map: any,
) {
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
    cy: avgH + 0.03 + elevationOffset,
    cz: (w1.z + w2.z) / 2,
    rotY: rot,
    scaleX: diagonal ? Math.SQRT2 : 1,
    isElevated: elevated,
  };
}

function TrackInstances() {
  const tracks = useGameStore(s => s.tracks);
  const map = useGameStore(s => s.map);

  const ballastRef = useRef<THREE.InstancedMesh>(null);
  const rail1Ref = useRef<THREE.InstancedMesh>(null);
  const rail2Ref = useRef<THREE.InstancedMesh>(null);
  const sleeperRef = useRef<THREE.InstancedMesh>(null);
  const pillarRef = useRef<THREE.InstancedMesh>(null);

  const segData = useMemo(() => {
    const segments = Array.from(tracks.values());
    const data = segments.map(seg => computeSegmentTransform(
      seg.startX, seg.startZ, seg.endX, seg.endZ,
      seg.direction, seg.elevation, map,
    ));
    const pillarCount = data.filter(d => d.isElevated).length * 2;
    return { segments, data, pillarCount };
  }, [tracks, map]);

  const segCount = segData.segments.length;
  const sleeperTotal = segCount * SLEEPER_COUNT;

  useEffect(() => {
    const { data } = segData;

    for (let i = 0; i < data.length; i++) {
      const d = data[i];

      // Ballast
      _pos.set(d.cx, d.cy, d.cz);
      _euler.set(0, d.rotY, 0);
      _quat.setFromEuler(_euler);
      _scale.set(d.scaleX, 1, 1);
      _mat4.compose(_pos, _quat, _scale);
      ballastRef.current?.setMatrixAt(i, _mat4);

      // Rails (offset in local Z)
      for (const [ref, zOff] of [[rail1Ref, 0.12], [rail2Ref, -0.12]] as const) {
        _pos.set(
          d.cx + Math.sin(d.rotY) * zOff * d.scaleX,
          d.cy + 0.055,
          d.cz + Math.cos(d.rotY) * zOff * d.scaleX,
        );
        // No, this is wrong for local-space offsets. Let me compute properly.
        // Use a local-to-world approach: apply rotation to the local offset
        const localX = 0;
        const localZ = zOff;
        const cosR = Math.cos(d.rotY);
        const sinR = Math.sin(d.rotY);
        _pos.set(
          d.cx + (localX * cosR - localZ * sinR) * d.scaleX,
          d.cy + 0.055,
          d.cz + (localX * sinR + localZ * cosR) * d.scaleX,
        );
        _euler.set(0, d.rotY, 0);
        _quat.setFromEuler(_euler);
        _scale.set(d.scaleX, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        ref.current?.setMatrixAt(i, _mat4);
      }

      // Sleepers
      for (let j = 0; j < SLEEPER_COUNT; j++) {
        const localX = sleeperOffsets[j];
        const cosR = Math.cos(d.rotY);
        const sinR = Math.sin(d.rotY);
        _pos.set(
          d.cx + localX * cosR * d.scaleX,
          d.cy + 0.035,
          d.cz + localX * sinR * d.scaleX,
        );
        _euler.set(0, d.rotY, 0);
        _quat.setFromEuler(_euler);
        _scale.set(d.scaleX, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        sleeperRef.current?.setMatrixAt(i * SLEEPER_COUNT + j, _mat4);
      }
    }

    // Pillars for elevated segments
    let pi = 0;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (!d.isElevated) continue;
      for (const localX of [-0.3, 0.3]) {
        const cosR = Math.cos(d.rotY);
        const sinR = Math.sin(d.rotY);
        _pos.set(
          d.cx + localX * cosR * d.scaleX,
          d.cy - 0.5,
          d.cz + localX * sinR * d.scaleX,
        );
        _euler.set(0, d.rotY, 0);
        _quat.setFromEuler(_euler);
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        pillarRef.current?.setMatrixAt(pi++, _mat4);
      }
    }

    // Notify Three.js of updates
    if (ballastRef.current) ballastRef.current.instanceMatrix.needsUpdate = true;
    if (rail1Ref.current) rail1Ref.current.instanceMatrix.needsUpdate = true;
    if (rail2Ref.current) rail2Ref.current.instanceMatrix.needsUpdate = true;
    if (sleeperRef.current) sleeperRef.current.instanceMatrix.needsUpdate = true;
    if (pillarRef.current) pillarRef.current.instanceMatrix.needsUpdate = true;
  }, [segData]);

  if (segCount === 0) return null;

  return (
    <group>
      <instancedMesh ref={ballastRef} args={[ballastGeo, ballastMat, segCount]} receiveShadow />
      <instancedMesh ref={rail1Ref} args={[railGeo, railMat, segCount]} castShadow />
      <instancedMesh ref={rail2Ref} args={[railGeo, railMat, segCount]} castShadow />
      <instancedMesh ref={sleeperRef} args={[sleeperGeo, sleeperMat, sleeperTotal]} castShadow receiveShadow />
      {segData.pillarCount > 0 && (
        <instancedMesh ref={pillarRef} args={[pillarGeo, pillarMat, segData.pillarCount]} castShadow />
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
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.35, 4]} />
        <meshStandardMaterial color="#444" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[0.06, 0.12, 0.04]} />
        <meshStandardMaterial color="#222" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.32, 0.025]}>
        <circleGeometry args={[0.02, 8]} />
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
