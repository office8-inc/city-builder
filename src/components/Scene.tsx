import { useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Terrain } from './Terrain.tsx';
import { GridOverlay } from './GridHelper.tsx';
import { Camera } from './Camera.tsx';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';
import { worldToGrid, isValidGridPosition } from '../utils/grid.ts';

function SimulationLoop() {
  const tick = useGameStore(s => s.tick);
  const speed = useGameStore(s => s.speed);
  const tickAccumulator = useRef(0);

  useFrame((_, delta) => {
    if (speed === 0) return;
    // At 1x: 4 ticks/sec (each tick = 10 min game time → 40 min/sec)
    // At 8x: 32 ticks/sec → 320 min/sec ≈ ~5 hours/sec
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
  const setHoveredTile = useGameStore(s => s.setHoveredTile);
  const selectedTool = useGameStore(s => s.selectedTool);
  const placeTrack = useGameStore(s => s.placeTrack);
  const buildStation = useGameStore(s => s.buildStation);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const gridPos = worldToGrid(e.point.x, e.point.z);
    if (isValidGridPosition(gridPos.x, gridPos.z)) {
      setHoveredTile(gridPos);
    } else {
      setHoveredTile(null);
    }
  }, [setHoveredTile]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const gridPos = worldToGrid(e.point.x, e.point.z);
    if (!isValidGridPosition(gridPos.x, gridPos.z)) return;

    if (selectedTool === 'track_straight') {
      placeTrack(gridPos.x, gridPos.z, gridPos.x + 1, gridPos.z);
    } else if (selectedTool === 'station_build') {
      buildStation(gridPos.x, gridPos.z);
    }
  }, [selectedTool, placeTrack, buildStation]);

  const handlePointerLeave = useCallback(() => {
    setHoveredTile(null);
  }, [setHoveredTile]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
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
        case '4': setSpeed(8); break;
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

function Lights() {
  return (
    <>
      <ambientLight intensity={0.4} color="#8eaacc" />
      <directionalLight
        position={[80, 100, 60]}
        intensity={1.2}
        color="#fff5e6"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-bias={-0.001}
      />
      <directionalLight position={[-40, 50, -30]} intensity={0.25} color="#b4c8e8" />
      <hemisphereLight args={['#87ceeb', '#5a9e3e', 0.3]} />
    </>
  );
}

export function GameScene() {
  return (
    <Canvas
      shadows="soft"
      camera={{ position: [60, 50, 60], fov: 45, near: 0.1, far: 600 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
    >
      <fog attach="fog" args={['#b4d7f0', 80, 200]} />
      <Sky
        sunPosition={[100, 60, 80]}
        turbidity={3}
        rayleigh={0.5}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <Lights />
      <Camera />
      <Terrain />
      <GridOverlay />
      <InteractionPlane />
      <SimulationLoop />
      <KeyboardControls />
      <EffectComposer multisampling={0}>
        <ToneMapping mode={ToneMappingMode.AGX} />
        <Bloom luminanceThreshold={0.9} luminanceSmoothing={0.4} intensity={0.3} />
        <Vignette eskil={false} offset={0.2} darkness={0.4} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}
