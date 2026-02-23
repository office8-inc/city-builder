import { useRef, useEffect } from 'react';
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

  // Listen for minimap click events to move camera
  useEffect(() => {
    const handler = (e: Event) => {
      const { x, z } = (e as CustomEvent).detail;
      if (controlsRef.current) {
        const w = gridToWorld(x, z);
        controlsRef.current.target.set(w.x, 0, w.z);
        controlsRef.current.update();
      }
    };
    window.addEventListener('minimap-click', handler);
    return () => window.removeEventListener('minimap-click', handler);
  }, []);

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
  const followMode = useGameStore(s => s.followMode);

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

    if (followMode === 'cab') {
      // Cab view: driver's perspective
      const camX = trainX + ndx * 0.3;
      const camY = trainY + 0.12;
      const camZ = trainZ + ndz * 0.3;
      const lookX = trainX + ndx * 5;
      const lookY = trainY + 0.1;
      const lookZ = trainZ + ndz * 5;

      camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.12);
      const lookTarget = new THREE.Vector3(lookX, lookY, lookZ);
      camera.lookAt(lookTarget);
    } else {
      // Chase view: behind and above
      const camDist = 3;
      const camHeight = 1.5;
      const targetX = trainX + ndx * 2;
      const targetY = trainY + 0.3;
      const targetZ = trainZ + ndz * 2;
      const camX = trainX - ndx * camDist;
      const camY = trainY + camHeight;
      const camZ = trainZ - ndz * camDist;

      camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
      const lookTarget = new THREE.Vector3(targetX, targetY, targetZ);
      const currentLook = new THREE.Vector3();
      camera.getWorldDirection(currentLook);
      currentLook.multiplyScalar(5).add(camera.position);
      currentLook.lerp(lookTarget, 0.08);
      camera.lookAt(currentLook);
    }
  });

  return null;
}

function QuarterViewCamera() {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  const rotationRef = useRef(0); // 0, 90, 180, 270
  const zoomRef = useRef(40);

  // Listen for Q/E rotation keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'q' || e.key === 'Q') {
        rotationRef.current = (rotationRef.current - 45 + 360) % 360;
      } else if (e.key === 'e' || e.key === 'E') {
        rotationRef.current = (rotationRef.current + 45) % 360;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Apply camera position each frame
  useFrame(() => {
    const pitch = Math.PI / 6; // 30 degrees
    const rot = (rotationRef.current * Math.PI) / 180;
    const dist = zoomRef.current;

    const camX = targetRef.current.x + Math.cos(rot) * Math.cos(pitch) * dist;
    const camY = targetRef.current.y + Math.sin(pitch) * dist;
    const camZ = targetRef.current.z + Math.sin(rot) * Math.cos(pitch) * dist;

    camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.1);
    camera.lookAt(targetRef.current);
  });

  // Listen for scroll zoom
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      zoomRef.current = Math.max(15, Math.min(80, zoomRef.current + e.deltaY * 0.05));
    };
    window.addEventListener('wheel', handler, { passive: true });
    return () => window.removeEventListener('wheel', handler);
  }, []);

  // Listen for minimap click
  useEffect(() => {
    const handler = (e: Event) => {
      const { x, z } = (e as CustomEvent).detail;
      const w = gridToWorld(x, z);
      targetRef.current.set(w.x, 0, w.z);
    };
    window.addEventListener('minimap-click', handler);
    return () => window.removeEventListener('minimap-click', handler);
  }, []);

  // WASD movement
  useEffect(() => {
    const keysDown = new Set<string>();
    const handleDown = (e: KeyboardEvent) => keysDown.add(e.key.toLowerCase());
    const handleUp = (e: KeyboardEvent) => keysDown.delete(e.key.toLowerCase());

    const moveLoop = setInterval(() => {
      const speed = 0.5;
      const rot = (rotationRef.current * Math.PI) / 180;
      const forward = new THREE.Vector3(-Math.cos(rot), 0, -Math.sin(rot));
      const right = new THREE.Vector3(Math.sin(rot), 0, -Math.cos(rot));

      if (keysDown.has('w')) targetRef.current.add(forward.clone().multiplyScalar(speed));
      if (keysDown.has('s')) targetRef.current.add(forward.clone().multiplyScalar(-speed));
      if (keysDown.has('a')) targetRef.current.add(right.clone().multiplyScalar(-speed));
      if (keysDown.has('d')) targetRef.current.add(right.clone().multiplyScalar(speed));

      // Clamp
      const half = GRID_SIZE / 2;
      targetRef.current.x = Math.max(-half, Math.min(half, targetRef.current.x));
      targetRef.current.z = Math.max(-half, Math.min(half, targetRef.current.z));
    }, 16);

    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
      clearInterval(moveLoop);
    };
  }, []);

  return null;
}

// タイトル画面用: 街の中心をゆっくり周回する自動回転カメラ
function ShowcaseCamera() {
  const { camera } = useThree();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const radius = 30;
    const speed = 0.06;
    const angle = t * speed;
    const height = 20 + Math.sin(t * 0.12) * 4;

    camera.position.set(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius,
    );
    camera.lookAt(0, 1, 0);
  });

  return null;
}

export function Camera() {
  const cameraMode = useGameStore(s => s.cameraMode);
  const gamePhase = useGameStore(s => s.gamePhase);

  if (gamePhase === 'title') return <ShowcaseCamera />;
  if (cameraMode === 'follow') return <FollowCamera />;
  if (cameraMode === 'quarter') return <QuarterViewCamera />;
  return <FreeCamera />;
}
