import { useMemo, Suspense, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useGLTF, Clone } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { Building, BuildingCategory } from '../game/types.ts';

const BASE = import.meta.env.BASE_URL;

// === Kenney Suburban buildings (residential) ===
const SUBURBAN_BUILDINGS = Array.from({ length: 21 }, (_, i) =>
  BASE + `models/kenney-suburban/building-type-${String.fromCharCode(97 + i)}.glb`
);

// === Kenney Commercial buildings ===
const COMMERCIAL_BUILDINGS = Array.from({ length: 14 }, (_, i) =>
  BASE + `models/kenney-commercial/building-${String.fromCharCode(97 + i)}.glb`
);
const COMMERCIAL_SKYSCRAPERS = Array.from({ length: 5 }, (_, i) =>
  BASE + `models/kenney-commercial/building-skyscraper-${String.fromCharCode(97 + i)}.glb`
);
// === Industrial (existing kenney-buildings hangars) ===
const INDUSTRIAL_BUILDINGS = [
  BASE + 'models/kenney-buildings/hangar_smallA.glb',
  BASE + 'models/kenney-buildings/hangar_smallB.glb',
  BASE + 'models/kenney-buildings/hangar_roundA.glb',
  BASE + 'models/kenney-buildings/hangar_roundB.glb',
  BASE + 'models/kenney-buildings/hangar_largeA.glb',
  BASE + 'models/kenney-buildings/hangar_largeB.glb',
];

// Building model selection by category and level
const BUILDING_MODELS: Record<string, { minLevel: number; maxLevel: number; models: string[] }[]> = {
  residential: [
    { minLevel: 1, maxLevel: 2, models: SUBURBAN_BUILDINGS.slice(0, 10) },
    { minLevel: 3, maxLevel: 4, models: SUBURBAN_BUILDINGS.slice(10, 17) },
    { minLevel: 5, maxLevel: 99, models: SUBURBAN_BUILDINGS.slice(17) },
  ],
  commercial: [
    { minLevel: 1, maxLevel: 2, models: COMMERCIAL_BUILDINGS.slice(0, 7) },
    { minLevel: 3, maxLevel: 4, models: COMMERCIAL_BUILDINGS.slice(7) },
    { minLevel: 5, maxLevel: 99, models: COMMERCIAL_SKYSCRAPERS },
  ],
  office: [
    { minLevel: 1, maxLevel: 2, models: COMMERCIAL_BUILDINGS.slice(0, 7) },
    { minLevel: 3, maxLevel: 4, models: COMMERCIAL_BUILDINGS.slice(7) },
    { minLevel: 5, maxLevel: 99, models: COMMERCIAL_SKYSCRAPERS },
  ],
  industrial: [
    { minLevel: 1, maxLevel: 99, models: INDUSTRIAL_BUILDINGS },
  ],
  leisure: [],
  culture: [],
  agriculture: [],
};

// Preload all models
const allPaths = new Set<string>();
for (const tiers of Object.values(BUILDING_MODELS)) {
  for (const tier of tiers) {
    for (const p of tier.models) allPaths.add(p);
  }
}
allPaths.forEach(p => useGLTF.preload(p));

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

  const { scale, rotY } = useMemo(() => {
    const seed = building.x * 1000 + building.z;
    const isSuburban = modelPath.includes('kenney-suburban');
    const isCommercial = modelPath.includes('kenney-commercial');
    const isSkyscraper = modelPath.includes('skyscraper');

    // Kenney models are ~1 unit base. Scale based on building size.
    let baseScale: number;
    if (isSuburban) {
      baseScale = 0.35 + building.level * 0.05;
    } else if (isSkyscraper) {
      baseScale = 0.5 + building.level * 0.1;
    } else if (isCommercial) {
      baseScale = 0.35 + building.level * 0.08;
    } else {
      // Industrial
      baseScale = 0.4 + Math.min(building.width, building.depth) * 0.1;
    }

    return {
      scale: [baseScale, baseScale, baseScale] as [number, number, number],
      rotY: Math.floor(seededRandom(seed + 50) * 4) * (Math.PI / 2),
    };
  }, [building, modelPath]);

  // Night window glow
  useEffect(() => {
    if (!ref.current) return;
    const shouldGlow = isNight && (building.type === 'residential' || building.type === 'commercial' || building.type === 'office');
    const seed = building.x * 31 + building.z * 17;
    const intensity = shouldGlow ? 0.15 + (seed % 10) * 0.03 : 0;
    const emissiveColor = building.type === 'commercial' ? '#ffcc55' : '#ffddaa';

    ref.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (!child.userData._matCloned) {
          child.material = child.material.clone();
          child.userData._matCloned = true;
        }
        if (shouldGlow) {
          child.material.emissive = new THREE.Color(emissiveColor);
          child.material.emissiveIntensity = intensity;
        } else {
          child.material.emissiveIntensity = 0;
        }
      }
    });
  }, [isNight, building.type, building.x, building.z]);

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
      if (!modelPath) continue;

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

      result.push({ building: b, modelPath, position: [wc.x, h + 0.02, wc.z] });
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
