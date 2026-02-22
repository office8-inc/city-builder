import { useRef, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, SMAA, Vignette } from '@react-three/postprocessing';
import { Terrain } from './Terrain.tsx';
import { Tracks } from './Tracks.tsx';
import { Stations } from './Stations.tsx';
import { Trains } from './Trains.tsx';
import { Buildings } from './Buildings.tsx';
import { Subsidiaries } from './Subsidiaries.tsx';
import { Roads } from './Roads.tsx';
import { GridOverlay } from './GridHelper.tsx';
import { Camera } from './Camera.tsx';
import { Weather } from './Weather.tsx';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';
import { worldToGrid, isValidGridPosition } from '../utils/grid.ts';

function SimulationLoop() {
  const tick = useGameStore(s => s.tick);
  const speed = useGameStore(s => s.speed);
  const gamePhase = useGameStore(s => s.gamePhase);
  const tickAccumulator = useRef(0);

  useFrame((_, delta) => {
    if (speed === 0 || gamePhase === 'title') return;
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
  const placeTrain = useGameStore(s => s.placeTrain);
  const buildSubsidiary = useGameStore(s => s.buildSubsidiary);
  const removeTrack = useGameStore(s => s.removeTrack);
  const bulldoze = useGameStore(s => s.bulldoze);
  const placeSignal = useGameStore(s => s.placeSignal);
  const buyLand = useGameStore(s => s.buyLand);
  const sellLand = useGameStore(s => s.sellLand);

  const dragStartRef = useRef<{ x: number; z: number } | null>(null);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const gridPos = worldToGrid(e.point.x, e.point.z);
    if (isValidGridPosition(gridPos.x, gridPos.z)) {
      setHoveredTile(gridPos);
    } else {
      setHoveredTile(null);
    }
  }, [setHoveredTile]);

  const isTrackTool = (tool: string) =>
    tool === 'track_straight' || tool === 'track_diagonal' ||
    tool === 'track_elevated' || tool === 'track_underground';

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (isTrackTool(selectedTool)) {
      const gridPos = worldToGrid(e.point.x, e.point.z);
      if (isValidGridPosition(gridPos.x, gridPos.z)) {
        dragStartRef.current = gridPos;
      }
    }
  }, [selectedTool]);

  const isStationTool = (tool: string) =>
    tool.startsWith('station_');

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const gridPos = worldToGrid(e.point.x, e.point.z);
    if (!isValidGridPosition(gridPos.x, gridPos.z)) {
      dragStartRef.current = null;
      return;
    }

    if (isTrackTool(selectedTool) && dragStartRef.current) {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      if (start.x !== gridPos.x || start.z !== gridPos.z) {
        placeTrack(start.x, start.z, gridPos.x, gridPos.z);
      }
    } else if (isStationTool(selectedTool)) {
      buildStation(gridPos.x, gridPos.z);
    } else if (selectedTool === 'train_place') {
      const state = useGameStore.getState();
      const tile = state.map[gridPos.x]?.[gridPos.z];
      if (tile?.stationId) {
        placeTrain(tile.stationId);
      }
    } else if (selectedTool === 'subsidiary_build') {
      buildSubsidiary(gridPos.x, gridPos.z);
    } else if (selectedTool === 'track_remove') {
      removeTrack(gridPos.x, gridPos.z);
    } else if (selectedTool === 'bulldoze') {
      bulldoze(gridPos.x, gridPos.z);
    } else if (selectedTool === 'signal_place') {
      placeSignal(gridPos.x, gridPos.z);
    } else if (selectedTool === 'land_buy') {
      buyLand(gridPos.x, gridPos.z);
    } else if (selectedTool === 'land_sell') {
      sellLand(gridPos.x, gridPos.z);
    }
  }, [selectedTool, placeTrack, buildStation, placeTrain, buildSubsidiary, removeTrack, bulldoze, placeSignal, buyLand, sellLand]);

  const handlePointerLeave = useCallback(() => {
    setHoveredTile(null);
    dragStartRef.current = null;
  }, [setHoveredTile]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
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
      const state = useGameStore.getState();
      // Don't handle shortcuts during title/tutorial phases (except Escape)
      if (state.gamePhase !== 'playing' && e.key !== 'Escape') return;

      switch (e.key) {
        case '1': setSpeed(1); break;
        case '2': setSpeed(2); break;
        case '3': setSpeed(4); break;
        case '4': setSpeed(8); break;
        case '5': setSpeed(16); break;
        case ' ':
          e.preventDefault();
          setSpeed(speed === 0 ? 1 : 0);
          break;
        case 'f':
        case 'F':
          state.toggleFinancePanel();
          break;
        case 'h':
        case 'H':
        case '?':
          state.toggleHelpPanel();
          break;
        case 't':
        case 'T':
          state.setCameraMode(state.cameraMode === 'follow' ? 'free' : 'follow');
          break;
        case 'v':
        case 'V':
          if (state.cameraMode === 'follow') {
            // Toggle follow mode between chase and cab
            state.setFollowMode(state.followMode === 'chase' ? 'cab' : 'chase');
          } else {
            state.setCameraMode(state.cameraMode === 'quarter' ? 'free' : 'quarter');
          }
          break;
        case 's':
          if (!e.ctrlKey && !e.metaKey) state.saveGame();
          break;
        case 'l':
          if (!e.ctrlKey && !e.metaKey) {
            state.loadGame();
            state.setGamePhase('playing');
          }
          break;
        case 'Escape': {
          if (state.showHelpPanel) {
            state.toggleHelpPanel();
          } else if (state.showFinancePanel) {
            state.toggleFinancePanel();
          } else if (state.showSchedulePanel) {
            state.toggleSchedulePanel();
          } else if (state.showSettingsPanel) {
            state.toggleSettingsPanel();
          } else if (state.cameraMode === 'follow') {
            state.setCameraMode('free');
          } else if (state.cameraMode === 'quarter') {
            state.setCameraMode('free');
          } else if (state.selectedTool !== 'none') {
            state.setSelectedTool('none');
          }
          break;
        }
        case 'Tab': {
          e.preventDefault();
          if (state.cameraMode === 'follow' && state.trains.size > 0) {
            const ids = Array.from(state.trains.keys());
            const currentIdx = state.followTrainId ? ids.indexOf(state.followTrainId) : -1;
            const nextIdx = (currentIdx + 1) % ids.length;
            state.setFollowTrainId(ids[nextIdx]);
          }
          break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSpeed, speed]);

  return null;
}

// Day/night lighting calculations
function getDayNightParams(hour: number) {
  const sunAngle = ((hour - 6) / 12) * Math.PI;
  const sunX = Math.cos(sunAngle) * 100;
  const sunY = Math.sin(sunAngle) * 100;
  const sunZ = 80;

  const isDaytime = hour >= 6 && hour < 18;
  const isTwilight = (hour >= 5 && hour < 6) || (hour >= 18 && hour < 19);

  let ambientIntensity: number;
  let ambientColor: string;
  let sunIntensity: number;
  let sunColor: string;
  let fogColor: string;
  let skyTurbidity: number;

  if (isDaytime) {
    const midday = 1 - Math.abs(hour - 12) / 6;
    ambientIntensity = 0.4 + midday * 0.15;
    ambientColor = '#b8c8d8';
    sunIntensity = 1.0 + midday * 0.6;
    sunColor = midday > 0.5 ? '#fff5e6' : '#ffddaa';
    fogColor = '#9ec8e8';
    skyTurbidity = 3;
  } else if (isTwilight) {
    ambientIntensity = 0.15;
    ambientColor = '#667799';
    sunIntensity = 0.3;
    sunColor = '#ff9944';
    fogColor = '#7799aa';
    skyTurbidity = 8;
  } else {
    ambientIntensity = 0.08;
    ambientColor = '#223355';
    sunIntensity = 0.05;
    sunColor = '#334466';
    fogColor = '#112233';
    skyTurbidity = 10;
  }

  return {
    sunPosition: [sunX, Math.max(sunY, -30), sunZ] as [number, number, number],
    ambientIntensity,
    ambientColor,
    sunIntensity,
    sunColor,
    fogColor,
    skyTurbidity,
    isDaytime,
  };
}

function DynamicLights() {
  const hour = useGameStore(s => s.gameTime.hour);
  const minute = useGameStore(s => s.gameTime.minute);

  const params = useMemo(
    () => getDayNightParams(hour + minute / 60),
    [hour, minute]
  );

  return (
    <>
      <ambientLight intensity={params.ambientIntensity} color={params.ambientColor} />
      <directionalLight
        position={params.sunPosition}
        intensity={params.sunIntensity}
        color={params.sunColor}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-bias={-0.001}
      />
      <directionalLight
        position={[-40, 50, -30]}
        intensity={params.isDaytime ? 0.25 : 0.05}
        color={params.isDaytime ? '#b4c8e8' : '#223344'}
      />
      <hemisphereLight
        args={[
          params.isDaytime ? '#4a90d9' : '#112244',
          params.isDaytime ? '#3a8a2a' : '#1a2a1a',
          params.isDaytime ? 0.45 : 0.1,
        ]}
      />
    </>
  );
}

function DynamicFog() {
  const hour = useGameStore(s => s.gameTime.hour);
  const params = useMemo(() => getDayNightParams(hour), [hour]);

  return <fog attach="fog" args={[params.fogColor, 100, 280]} />;
}

function DynamicSky() {
  const hour = useGameStore(s => s.gameTime.hour);
  const minute = useGameStore(s => s.gameTime.minute);
  const params = useMemo(
    () => getDayNightParams(hour + minute / 60),
    [hour, minute]
  );

  return (
    <group>
      <Sky
        sunPosition={params.sunPosition}
        turbidity={params.skyTurbidity}
        rayleigh={params.isDaytime ? 3.0 : 0.1}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <mesh>
        <sphereGeometry args={[400, 32, 16]} />
        <meshBasicMaterial
          color={params.isDaytime ? '#5b9bd5' : '#0a1628'}
          side={THREE.BackSide}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function GameScene() {
  return (
    <Canvas
      shadows="soft"
      camera={{ position: [60, 50, 60], fov: 45, near: 0.1, far: 600 }}
      style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #4a8fd4 0%, #87ceeb 40%, #b8dff0 100%)' }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      onCreated={({ gl }) => { gl.setClearColor('#87ceeb', 1); }}
    >
      <DynamicFog />
      <DynamicSky />
      <DynamicLights />
      <Camera />
      <Terrain />
      <Roads />
      <Tracks />
      <Stations />
      <Trains />
      <Buildings />
      <Subsidiaries />
      <Weather />
      <GridOverlay />
      <InteractionPlane />
      <SimulationLoop />
      <KeyboardControls />
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.4} intensity={0.3} />
        <Vignette eskil={false} offset={0.15} darkness={0.3} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}
