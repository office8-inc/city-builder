import { useMemo, Suspense, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useGLTF, Clone } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { Building, BuildingCategory } from '../game/types.ts';

// カラーマップから窓（青色ピクセル）を検出してemissiveMapを生成するキャッシュ
const emissiveMapCache = new WeakMap<THREE.Texture, THREE.Texture>();

function getWindowEmissiveMap(colorMap: THREE.Texture): THREE.Texture | null {
  if (emissiveMapCache.has(colorMap)) return emissiveMapCache.get(colorMap)!;
  const image = colorMap.image;
  if (!image || !(image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof ImageBitmap)) {
    return null;
  }
  const w = image.width || 256;
  const h = image.height || 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image as CanvasImageSource, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // 青色検出: Kenneyのcolormapで窓は青/紺色
    // 青成分が高く、赤緑が比較的低い場合 → 窓
    const isWindow = b > 100 && b > r * 1.3 && b > g * 1.2;
    if (isWindow) {
      // 暖色の窓明かり
      data[i] = 255;     // R
      data[i + 1] = 210; // G
      data[i + 2] = 120; // B
    } else {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  const emissiveTex = new THREE.CanvasTexture(canvas);
  emissiveTex.flipY = colorMap.flipY;
  emissiveTex.colorSpace = colorMap.colorSpace;
  emissiveTex.wrapS = colorMap.wrapS;
  emissiveTex.wrapT = colorMap.wrapT;
  emissiveMapCache.set(colorMap, emissiveTex);
  return emissiveTex;
}

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
// === Leisure (parks, recreation) — Kenneyのみ ===
const LEISURE_BUILDINGS = [
  BASE + 'models/kenney-suburban/building-type-a.glb',
  BASE + 'models/kenney-suburban/building-type-b.glb',
  BASE + 'models/kenney-suburban/building-type-c.glb',
];
// === Culture (temples, museums) ===
const CULTURE_BUILDINGS = [
  BASE + 'models/kenney-buildings/gate_complex.glb',
  BASE + 'models/kenney-suburban/building-type-d.glb',
];
// === Agriculture (farms) — Kenneyのみ ===
const AGRICULTURE_BUILDINGS = [
  BASE + 'models/kenney-buildings/hangar_smallB.glb',
  BASE + 'models/kenney-buildings/hangar_smallA.glb',
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
  leisure: [
    { minLevel: 1, maxLevel: 99, models: LEISURE_BUILDINGS },
  ],
  culture: [
    { minLevel: 1, maxLevel: 99, models: CULTURE_BUILDINGS },
  ],
  agriculture: [
    { minLevel: 1, maxLevel: 99, models: AGRICULTURE_BUILDINGS },
  ],
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

    // Kenneyモデルはデフォルトスケール1.0で1グリッドセル相当
    // 道路=1.0に合わせ、レベルでわずかに変化
    const baseScale = 1.0 + building.level * 0.05;

    return {
      scale: [baseScale, baseScale, baseScale] as [number, number, number],
      rotY: Math.floor(seededRandom(seed + 50) * 4) * (Math.PI / 2),
    };
  }, [building]);

  // 夜間の窓明かり: colormapの青色ピクセル（窓）をemissiveMapとして発光
  const shouldGlow = isNight && (building.type === 'residential' || building.type === 'commercial' || building.type === 'office');

  useEffect(() => {
    if (!ref.current) return;
    ref.current.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!(child.material instanceof THREE.MeshStandardMaterial)) return;
      if (!child.userData._matCloned) {
        child.material = child.material.clone();
        child.userData._matCloned = true;
      }
      const mat = child.material;
      if (shouldGlow) {
        // colormapからwindow emissive mapを生成/キャッシュ
        if (mat.map && !mat.userData._emissiveReady) {
          const emap = getWindowEmissiveMap(mat.map);
          if (emap) {
            mat.emissiveMap = emap;
            mat.userData._emissiveReady = true;
          }
        }
        mat.emissive.set('#ffffff');
        mat.emissiveIntensity = 1.2;
        mat.needsUpdate = true;
      } else {
        mat.emissiveIntensity = 0;
        mat.needsUpdate = true;
      }
    });
  }, [shouldGlow]);

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
      {/* 窓の光スピル: 道路街灯と同様にpointLightで周囲を照らす */}
      {shouldGlow && (
        <pointLight
          position={[0, scale[1] * 0.4, 0]}
          color="#ffeecc"
          intensity={0.8 + building.level * 0.2}
          distance={3 + building.level}
          decay={2}
        />
      )}
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
