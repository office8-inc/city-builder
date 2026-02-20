import { useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Terrain } from './Terrain.tsx';
import { Buildings } from './Building.tsx';
import { GridOverlay } from './GridHelper.tsx';
import { Camera } from './Camera.tsx';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';
import { worldToGrid, isValidGridPosition } from '../utils/grid.ts';
import { PALETTE } from '../utils/colors.ts';

function SimulationLoop() {
  const tick = useGameStore(s => s.tick);
  const speed = useGameStore(s => s.speed);
  const tickAccumulator = useRef(0);

  useFrame((_, delta) => {
    if (speed === 0) return;

    const ticksPerSecond = speed * 4;
    tickAccumulator.current += delta * ticksPerSecond;

    while (tickAccumulator.current >= 1) {
      tick();
      tickAccumulator.current -= 1;
    }
  });

  return null;
}

function InteractionPlane() {
  const planeRef = useRef<THREE.Mesh>(null);
  const setHoveredTile = useGameStore(s => s.setHoveredTile);
  const placeBuilding = useGameStore(s => s.placeBuilding);
  const bulldoze = useGameStore(s => s.bulldoze);
  const selectedTool = useGameStore(s => s.selectedTool);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const point = e.point;
    const gridPos = worldToGrid(point.x, point.z);
    if (isValidGridPosition(gridPos.x, gridPos.z)) {
      setHoveredTile(gridPos);
    } else {
      setHoveredTile(null);
    }
  }, [setHoveredTile]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const point = e.point;
    const gridPos = worldToGrid(point.x, point.z);
    if (isValidGridPosition(gridPos.x, gridPos.z)) {
      if (selectedTool === 'bulldoze') {
        bulldoze(gridPos.x, gridPos.z);
      } else if (selectedTool !== 'none') {
        placeBuilding(gridPos.x, gridPos.z);
      }
    }
  }, [selectedTool, placeBuilding, bulldoze]);

  const handlePointerLeave = useCallback(() => {
    setHoveredTile(null);
  }, [setHoveredTile]);

  return (
    <mesh
      ref={planeRef}
      position={[0, 0, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      onPointerLeave={handlePointerLeave}
    >
      <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

function KeyboardControls() {
  const setSpeed = useGameStore(s => s.setSpeed);
  const speed = useGameStore(s => s.speed);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case '1': setSpeed(1); break;
        case '2': setSpeed(2); break;
        case '3': setSpeed(4); break;
        case ' ':
          e.preventDefault();
          setSpeed(speed === 0 ? 1 : 0);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSpeed, speed]);

  return null;
}

export function GameScene() {
  return (
    <Canvas
      camera={{
        position: [40, 35, 40],
        fov: 45,
        near: 0.1,
        far: 500,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={[PALETTE.background]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[50, 80, 50]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <Camera />
      <Terrain />
      <Buildings />
      <GridOverlay />
      <InteractionPlane />
      <SimulationLoop />
      <KeyboardControls />
    </Canvas>
  );
}
