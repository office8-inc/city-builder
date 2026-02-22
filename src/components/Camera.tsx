import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GRID_SIZE } from '../game/constants.ts';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';

function FreeCamera() {
  const halfGrid = GRID_SIZE / 2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  // Remap mouse buttons on mount
  useFrame(() => {
    if (controlsRef.current && controlsRef.current.mouseButtons.LEFT !== -1) {
      controlsRef.current.mouseButtons = { LEFT: -1, MIDDLE: 2, RIGHT: 0 };
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={10}
      maxDistance={120}
      maxPolarAngle={Math.PI / 2.5}
      minPolarAngle={Math.PI / 10}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={1.2}
      panSpeed={0.8}
      onChange={(e) => {
        if (e?.target) {
          const ctrl = e.target;
          const t = ctrl.target;
          t.x = Math.max(-halfGrid, Math.min(halfGrid, t.x));
          t.z = Math.max(-halfGrid, Math.min(halfGrid, t.z));
          t.y = Math.max(0, Math.min(5, t.y));
        }
      }}
    />
  );
}

function FollowCamera() {
  const { camera } = useThree();
  const followTrainId = useGameStore(s => s.followTrainId);

  useFrame(() => {
    if (!followTrainId) return;
    const { trains, tracks, map } = useGameStore.getState();
    const train = trains.get(followTrainId);
    if (!train) return;

    const segment = tracks.get(train.currentSegmentId);
    if (!segment) return;

    const w1 = gridToWorld(segment.startX, segment.startZ);
    const w2 = gridToWorld(segment.endX, segment.endZ);
    const tile1 = map[segment.startX]?.[segment.startZ];
    const tile2 = map[segment.endX]?.[segment.endZ];
    const h1 = tile1 ? getTileWorldHeight(tile1) : 0;
    const h2 = tile2 ? getTileWorldHeight(tile2) : 0;

    const p = train.positionOnSegment;
    const trainX = w1.x + (w2.x - w1.x) * p;
    const trainY = h1 + (h2 - h1) * p + 0.15;
    const trainZ = w1.z + (w2.z - w1.z) * p;

    // Direction the train is facing
    const dx = w2.x - w1.x;
    const dz = w2.z - w1.z;
    const dir = train.direction;
    const dirX = dir === 1 ? dx : -dx;
    const dirZ = dir === 1 ? dz : -dz;
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
    const ndx = dirX / len;
    const ndz = dirZ / len;

    // Camera behind and above train
    const camDist = 3;
    const camHeight = 1.5;
    const targetX = trainX + ndx * 2;
    const targetY = trainY + 0.3;
    const targetZ = trainZ + ndz * 2;
    const camX = trainX - ndx * camDist;
    const camY = trainY + camHeight;
    const camZ = trainZ - ndz * camDist;

    // Smooth follow
    camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
    const lookTarget = new THREE.Vector3(targetX, targetY, targetZ);
    const currentLook = new THREE.Vector3();
    camera.getWorldDirection(currentLook);
    currentLook.multiplyScalar(5).add(camera.position);
    currentLook.lerp(lookTarget, 0.08);
    camera.lookAt(currentLook);
  });

  return null;
}

export function Camera() {
  const cameraMode = useGameStore(s => s.cameraMode);

  if (cameraMode === 'follow') {
    return <FollowCamera />;
  }
  return <FreeCamera />;
}
