import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { Building, BuildingCategory } from '../game/types.ts';

// Seeded random for consistent building appearance per tile
function seededRandom(seed: number): number {
  let s = seed | 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Curated color palettes per category (spec: warm/cool/bright tones)
const CATEGORY_COLORS: Record<string, string[]> = {
  residential: ['#f5f0e8', '#e8dcc8', '#d4c4a0', '#fff8f0', '#e0d0b8', '#c8b89a'],
  commercial: ['#ffffff', '#e8f4f8', '#d0e8d0', '#f0f8ff', '#dceef8', '#c8e0d0'],
  office: ['#a0a8b0', '#384868', '#c0c8d0', '#506880', '#b0b8c0', '#607890'],
  industrial: ['#808080', '#2d5a2d', '#606060', '#405840', '#707070', '#4a6848'],
  leisure: ['#55bb55', '#44aa44', '#66cc66', '#33aa33', '#77dd77', '#228822'],
  culture: ['#bb8866', '#aa7755', '#cc9977', '#997744', '#ddaa88', '#887060'],
  agriculture: ['#66aa44', '#559933', '#77bb55', '#448822', '#88cc66', '#4a8830'],
};

function getBuildingColor(type: string, seed: number): string {
  const colors = CATEGORY_COLORS[type] || CATEGORY_COLORS.residential;
  return colors[Math.floor(seededRandom(seed) * colors.length)];
}

// Shared window textures per category (max 6 variations each)
// Key: `${category}_${variationIndex}_${isNight}`
const textureCache = new Map<string, THREE.CanvasTexture>();

function getSharedWindowTexture(
  category: BuildingCategory,
  variationSeed: number,
  isNight: boolean,
  wallColor: string,
): THREE.CanvasTexture {
  const variationIndex = Math.abs(variationSeed) % 6;
  const key = `${category}_${variationIndex}_${isNight}`;

  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const cols = 6;
  const rows = 8;
  canvas.width = cols * 10;
  canvas.height = rows * 10;
  const ctx = canvas.getContext('2d')!;

  // Wall background
  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Window grid
  const litColor = isNight ? '#ffe8a0' : '#a0d0f0';
  const warmLit = isNight ? '#ffd070' : '#90c0e0';
  const darkWindow = isNight ? '#283848' : '#607888';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rand = seededRandom(variationIndex * 10000 + r * 100 + c);
      if (isNight) {
        const lit = rand > 0.35;
        ctx.fillStyle = lit ? (rand > 0.7 ? warmLit : litColor) : darkWindow;
      } else {
        ctx.fillStyle = rand > 0.25 ? litColor : darkWindow;
      }
      // Window cell with frame margin
      ctx.fillRect(c * 10 + 2, r * 10 + 2, 7, 7);
      // Window divider (cross)
      ctx.fillStyle = wallColor;
      ctx.fillRect(c * 10 + 5, r * 10 + 2, 1, 7);
      ctx.fillRect(c * 10 + 2, r * 10 + 5, 7, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

// Flush texture cache when day/night changes
let lastNightState: boolean | null = null;
function flushTexturesIfNeeded(isNight: boolean) {
  if (lastNightState !== null && lastNightState !== isNight) {
    for (const tex of textureCache.values()) tex.dispose();
    textureCache.clear();
  }
  lastNightState = isNight;
}

// LOD levels: 'full' = windows + details, 'simple' = colored box only
type LODLevel = 'full' | 'simple';

// Individual building mesh
function BuildingMesh({ building, isNight, lod }: { building: Building; isNight: boolean; lod: LODLevel }) {
  const map = useGameStore(s => s.map);

  const { position, color, buildingHeight, roofType } = useMemo(() => {
    const centerX = building.x + (building.width - 1) / 2;
    const centerZ = building.z + (building.depth - 1) / 2;
    const w = gridToWorld(centerX, centerZ);
    const tile = map[building.x]?.[building.z];
    const h = tile ? getTileWorldHeight(tile) : 0;

    const seed = building.x * 1000 + building.z;
    const col = getBuildingColor(building.type, seed);
    const bh = building.height * 0.15 * building.level;

    let roof: 'flat' | 'pitched' | 'tiered' = 'flat';
    if (building.type === 'residential' && building.level <= 2) roof = 'pitched';
    if (building.subtype === 'temple') roof = 'tiered';

    return {
      position: [w.x, h, w.z] as [number, number, number],
      color: col,
      buildingHeight: Math.max(0.2, bh),
      roofType: roof,
    };
  }, [building, map]);

  const seed = building.x * 1000 + building.z;
  const bw = building.width * 0.85;
  const bd = building.depth * 0.85;
  const hasWindows = lod === 'full' && (building.height > 1 || building.type === 'commercial' || building.type === 'office');

  // Use shared window texture
  const windowTex = useMemo(() => {
    if (!hasWindows) return null;
    return getSharedWindowTexture(building.type, seed, isNight, color);
  }, [building.type, seed, isNight, hasWindows, color]);

  // Roof color for pitched roofs
  const roofColor = useMemo(() => {
    const r = seededRandom(seed + 200);
    return r > 0.5 ? '#8b4513' : '#a0522d'; // brown / sienna
  }, [seed]);

  // Simple LOD: just a colored box
  if (lod === 'simple') {
    return (
      <group position={position}>
        <mesh position={[0, buildingHeight / 2, 0]} castShadow>
          <boxGeometry args={[bw, buildingHeight, bd]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={position}>
      {/* Main body */}
      <mesh position={[0, buildingHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[bw, buildingHeight, bd]} />
        {windowTex ? (
          <meshStandardMaterial
            map={windowTex}
            color={color}
            roughness={0.55}
            metalness={building.type === 'office' ? 0.3 : 0.1}
            emissive={isNight ? '#ffdd88' : '#000000'}
            emissiveIntensity={isNight ? 0.4 : 0}
            emissiveMap={isNight ? windowTex : undefined}
          />
        ) : (
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.0}
          />
        )}
      </mesh>

      {/* === RESIDENTIAL: pitched roof for houses === */}
      {roofType === 'pitched' && (
        <mesh
          position={[0, buildingHeight + 0.1, 0]}
          rotation={[0, seededRandom(seed + 99) > 0.5 ? Math.PI / 2 : 0, 0]}
          castShadow
        >
          <coneGeometry args={[bw * 0.65, 0.18, 4]} />
          <meshStandardMaterial color={roofColor} roughness={0.85} />
        </mesh>
      )}

      {/* === RESIDENTIAL: rooftop structures for apartments (flat roof) === */}
      {building.type === 'residential' && roofType === 'flat' && buildingHeight > 0.5 && (
        <>
          {/* Water tank */}
          <mesh position={[bw * 0.25, buildingHeight + 0.08, bd * 0.15]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.12, 6]} />
            <meshStandardMaterial color="#778899" roughness={0.4} metalness={0.5} />
          </mesh>
          {/* AC unit */}
          <mesh position={[-bw * 0.2, buildingHeight + 0.04, -bd * 0.2]} castShadow>
            <boxGeometry args={[0.1, 0.06, 0.08]} />
            <meshStandardMaterial color="#889999" roughness={0.5} metalness={0.3} />
          </mesh>
        </>
      )}

      {/* === OFFICE: flat glass top + antenna/spire === */}
      {building.type === 'office' && buildingHeight > 0.3 && (
        <>
          {/* Glass top cap */}
          <mesh position={[0, buildingHeight + 0.02, 0]} castShadow>
            <boxGeometry args={[bw * 0.95, 0.04, bd * 0.95]} />
            <meshStandardMaterial color="#506880" roughness={0.2} metalness={0.6} />
          </mesh>
          {/* Antenna/spire for tall offices */}
          {buildingHeight > 1.0 && (
            <mesh position={[0, buildingHeight + 0.2, 0]} castShadow>
              <cylinderGeometry args={[0.01, 0.015, 0.35, 4]} />
              <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.8} />
            </mesh>
          )}
          {/* AC unit cluster */}
          <mesh position={[bw * 0.3, buildingHeight + 0.04, bd * 0.2]} castShadow>
            <boxGeometry args={[0.08, 0.06, 0.08]} />
            <meshStandardMaterial color="#888888" roughness={0.6} metalness={0.3} />
          </mesh>
        </>
      )}

      {/* === COMMERCIAL: awning + recessed ground floor === */}
      {building.type === 'commercial' && (
        <>
          {/* Recessed entrance dark band */}
          <mesh position={[0, 0.08, bd / 2 + 0.001]}>
            <planeGeometry args={[bw * 0.6, 0.14]} />
            <meshStandardMaterial color="#333333" roughness={0.9} />
          </mesh>
          {/* Awning */}
          <mesh position={[0, 0.16, bd / 2 + 0.06]} castShadow>
            <boxGeometry args={[bw * 0.85, 0.02, 0.12]} />
            <meshStandardMaterial
              color={seededRandom(seed + 55) > 0.5 ? '#cc3333' : '#3366aa'}
              roughness={0.5}
            />
          </mesh>
          {/* Backside awning for variety */}
          {seededRandom(seed + 88) > 0.5 && (
            <mesh position={[0, 0.16, -bd / 2 - 0.06]} castShadow>
              <boxGeometry args={[bw * 0.85, 0.02, 0.12]} />
              <meshStandardMaterial
                color={seededRandom(seed + 66) > 0.5 ? '#cc3333' : '#3366aa'}
                roughness={0.5}
              />
            </mesh>
          )}
        </>
      )}

      {/* === TIERED ROOF for temples === */}
      {roofType === 'tiered' && (
        <>
          <mesh position={[0, buildingHeight + 0.05, 0]} castShadow>
            <boxGeometry args={[bw * 1.15, 0.05, bd * 1.15]} />
            <meshStandardMaterial color="#4a3828" roughness={0.8} />
          </mesh>
          <mesh position={[0, buildingHeight + 0.15, 0]} castShadow>
            <boxGeometry args={[bw * 0.85, 0.05, bd * 0.85]} />
            <meshStandardMaterial color="#4a3828" roughness={0.8} />
          </mesh>
          <mesh position={[0, buildingHeight + 0.25, 0]} castShadow>
            <coneGeometry args={[bw * 0.3, 0.12, 4]} />
            <meshStandardMaterial color="#4a3828" roughness={0.8} />
          </mesh>
        </>
      )}

      {/* === INDUSTRIAL: smokestacks === */}
      {building.type === 'industrial' && (
        <>
          <mesh position={[bw * 0.3, buildingHeight + 0.18, bd * 0.2]} castShadow>
            <cylinderGeometry args={[0.04, 0.055, 0.35, 6]} />
            <meshStandardMaterial color="#555555" roughness={0.6} metalness={0.5} />
          </mesh>
          {seededRandom(seed + 77) > 0.4 && (
            <mesh position={[-bw * 0.2, buildingHeight + 0.12, -bd * 0.15]} castShadow>
              <cylinderGeometry args={[0.03, 0.04, 0.24, 6]} />
              <meshStandardMaterial color="#666666" roughness={0.6} metalness={0.5} />
            </mesh>
          )}
        </>
      )}

      {/* === AGRICULTURE: crop rows === */}
      {building.type === 'agriculture' && (
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[bw, 0.03, bd]} />
          <meshStandardMaterial color="#88bb44" roughness={0.95} />
        </mesh>
      )}

      {/* === PARKS: flat with trees === */}
      {building.type === 'leisure' && building.subtype === 'park_small' && (
        <>
          <mesh position={[0, 0.01, 0]} receiveShadow>
            <boxGeometry args={[bw, 0.02, bd]} />
            <meshStandardMaterial color="#44cc44" roughness={0.95} />
          </mesh>
          <mesh position={[bw * 0.25, 0.15, bd * 0.2]} castShadow>
            <sphereGeometry args={[0.1, 6, 6]} />
            <meshStandardMaterial color="#228822" roughness={0.9} />
          </mesh>
          <mesh position={[-bw * 0.2, 0.12, -bd * 0.25]} castShadow>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial color="#22aa22" roughness={0.9} />
          </mesh>
        </>
      )}
    </group>
  );
}

export function Buildings() {
  const buildings = useGameStore(s => s.buildings);
  const hour = useGameStore(s => s.gameTime.hour);
  const { camera } = useThree();

  const isNight = hour < 6 || hour >= 18;
  flushTexturesIfNeeded(isNight);

  const buildingArray = useMemo(() => Array.from(buildings.values()), [buildings]);

  // Distance-based culling and LOD
  const camTarget = useMemo(() => {
    // Approximate camera target from camera position + direction
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return new THREE.Vector3().copy(camera.position).add(dir.multiplyScalar(30));
  }, [camera.position.x, camera.position.y, camera.position.z]);

  const visibleBuildings = useMemo(() => {
    const result: { building: Building; lod: LODLevel }[] = [];
    for (const b of buildingArray) {
      const w = gridToWorld(b.x, b.z);
      const dx = w.x - camTarget.x;
      const dz = w.z - camTarget.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 80) continue; // cull very far
      result.push({ building: b, lod: dist < 30 ? 'full' : 'simple' });
    }
    return result;
  }, [buildingArray, camTarget]);

  if (visibleBuildings.length === 0) return null;

  return (
    <group>
      {visibleBuildings.map(({ building, lod }) => (
        <BuildingMesh key={building.id} building={building} isNight={isNight} lod={lod} />
      ))}
    </group>
  );
}
