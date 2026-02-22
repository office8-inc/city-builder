import { useMemo, Suspense, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useGLTF, Clone } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { Building, BuildingCategory } from '../game/types.ts';

const BASE = import.meta.env.BASE_URL;

// Building model mapping: category + level -> model paths
// kenney GLBs: small residential buildings
// kaykit-city GTLFs: medium/large buildings with shared texture
// kenney-buildings: industrial hangars
const BUILDING_MODELS: Record<string, { minLevel: number; maxLevel: number; models: string[] }[]> = {
  residential: [
    { minLevel: 1, maxLevel: 2, models: [
      BASE + 'models/kaykit-city/building_A.gltf',
      BASE + 'models/kaykit-city/building_B.gltf',
      BASE + 'models/kenney-buildings/hangar_smallA.glb',
      BASE + 'models/kenney-nature/house.gltf.glb',
    ]},
    { minLevel: 3, maxLevel: 3, models: [
      BASE + 'models/kaykit-city/building_C.gltf',
      BASE + 'models/kaykit-city/building_D.gltf',
    ]},
    { minLevel: 4, maxLevel: 99, models: [
      BASE + 'models/kaykit-city/building_E.gltf',
      BASE + 'models/kaykit-city/building_F.gltf',
    ]},
  ],
  commercial: [
    { minLevel: 1, maxLevel: 2, models: [
      BASE + 'models/kaykit-city/building_A.gltf',
      BASE + 'models/kaykit-city/building_C.gltf',
    ]},
    { minLevel: 3, maxLevel: 99, models: [
      BASE + 'models/kaykit-city/building_F.gltf',
      BASE + 'models/kaykit-city/building_G.gltf',
    ]},
  ],
  office: [
    { minLevel: 1, maxLevel: 2, models: [
      BASE + 'models/kaykit-city/building_B.gltf',
      BASE + 'models/kaykit-city/building_C.gltf',
    ]},
    { minLevel: 3, maxLevel: 4, models: [
      BASE + 'models/kaykit-city/building_E.gltf',
      BASE + 'models/kaykit-city/building_F.gltf',
    ]},
    { minLevel: 5, maxLevel: 99, models: [
      BASE + 'models/kaykit-city/building_G.gltf',
      BASE + 'models/kaykit-city/building_H.gltf',
    ]},
  ],
  industrial: [
    { minLevel: 1, maxLevel: 99, models: [
      BASE + 'models/kenney-buildings/hangar_smallA.glb',
      BASE + 'models/kenney-buildings/hangar_smallB.glb',
      BASE + 'models/kenney-buildings/hangar_roundA.glb',
      BASE + 'models/kenney-buildings/hangar_roundB.glb',
    ]},
  ],
  // Omitted categories: no suitable models
  leisure: [],
  culture: [],
  agriculture: [],
};

// Collect all unique model paths for preloading
const allBuildingModelPaths = new Set<string>();
for (const tiers of Object.values(BUILDING_MODELS)) {
  for (const tier of tiers) {
    for (const p of tier.models) allBuildingModelPaths.add(p);
  }
}
allBuildingModelPaths.forEach(p => useGLTF.preload(p));

function seededRandom(seed: number): number {
  let s = seed | 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pickBuildingModel(category: BuildingCategory, level: number, seed: number): string | null {
  const tiers = BUILDING_MODELS[category];
  if (!tiers || tiers.length === 0) return null;

  for (const tier of tiers) {
    if (level >= tier.minLevel && level <= tier.maxLevel) {
      return tier.models[Math.abs(seed) % tier.models.length];
    }
  }
  // Fallback to last tier
  const last = tiers[tiers.length - 1];
  return last.models[Math.abs(seed) % last.models.length];
}

function GLBBuilding({ building, position, modelPath, isNight }: {
  building: Building;
  position: [number, number, number];
  modelPath: string;
  isNight: boolean;
}) {
  const { scene } = useGLTF(modelPath);
  const ref = useRef<THREE.Group>(null);

  // Compute scale based on building dimensions
  const { scale, rotY } = useMemo(() => {
    const seed = building.x * 1000 + building.z;
    const bw = building.width * 0.78;
    const bd = building.depth * 0.78;
    const rawH = building.height * building.level;
    const bh = rawH <= 5 ? rawH * 0.12 : 0.6 + (rawH - 5) * 0.06;
    const finalH = Math.max(0.2, bh);

    // Kenney models are ~1 unit, kaykit models are ~2 units
    const isKaykit = modelPath.includes('kaykit');
    const baseFactor = isKaykit ? 0.45 : 0.85;
    const xScale = Math.min(bw, bd) * baseFactor;
    const yScale = isKaykit ? finalH * 0.4 : finalH * 1.2;

    return {
      scale: [xScale, yScale, xScale] as [number, number, number],
      rotY: Math.floor(seededRandom(seed + 50) * 4) * (Math.PI / 2),
    };
  }, [building, modelPath]);

  // Night emissive
  useEffect(() => {
    if (!ref.current) return;
    ref.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (isNight) {
          child.material.emissive = new THREE.Color('#ffdd88');
          child.material.emissiveIntensity = 0.3;
        } else {
          child.material.emissiveIntensity = 0;
        }
      }
    });
  }, [isNight]);

  return (
    <group position={position}>
      <Clone
        ref={ref}
        object={scene}
        scale={scale}
        rotation={[0, rotY, 0]}
        castShadow
        receiveShadow
      />
    </group>
  );
}

export function Buildings() {
  const buildings = useGameStore(s => s.buildings);
  const map = useGameStore(s => s.map);
  const hour = useGameStore(s => s.gameTime.hour);
  const { camera } = useThree();
  const isNight = hour < 6 || hour >= 18;

  const buildingArray = useMemo(() => Array.from(buildings.values()), [buildings]);

  // Camera-based culling
  const camPos = camera.position;
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const t = camDir.y !== 0 ? -camPos.y / camDir.y : 20;
  const lookAtX = camPos.x + camDir.x * Math.max(0, Math.min(t, 60));
  const lookAtZ = camPos.z + camDir.z * Math.max(0, Math.min(t, 60));

  const visibleBuildings = useMemo(() => {
    const result: { building: Building; modelPath: string; position: [number, number, number] }[] = [];
    for (const b of buildingArray) {
      const w = gridToWorld(b.x, b.z);
      const dx = w.x - lookAtX;
      const dz = w.z - lookAtZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 100) continue;

      const seed = b.x * 1000 + b.z;
      const modelPath = pickBuildingModel(b.type, b.level, seed);
      if (!modelPath) continue; // Omit unsupported categories

      // Compute position
      const centerX = b.x + (b.width - 1) / 2;
      const centerZ = b.z + (b.depth - 1) / 2;
      const wc = gridToWorld(centerX, centerZ);
      let h = 0;
      for (let ddx = 0; ddx < b.width; ddx++) {
        for (let ddz = 0; ddz < b.depth; ddz++) {
          const tile = map[b.x + ddx]?.[b.z + ddz];
          if (tile) h = Math.max(h, getTileWorldHeight(tile));
        }
      }

      result.push({ building: b, modelPath, position: [wc.x, h, wc.z] });
    }
    return result;
  }, [buildingArray, lookAtX, lookAtZ, map]);

  if (visibleBuildings.length === 0) return null;

  return (
    <Suspense fallback={null}>
      <group>
        {visibleBuildings.map(({ building, modelPath, position }) => (
          <GLBBuilding
            key={building.id}
            building={building}
            position={position}
            modelPath={modelPath}
            isNight={isNight}
          />
        ))}
      </group>
    </Suspense>
  );
}
