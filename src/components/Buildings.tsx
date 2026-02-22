import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { Building } from '../game/types.ts';

// Seeded random for consistent building appearance per tile
function seededRandom(seed: number): number {
  let s = seed | 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Create a window texture using CanvasTexture
function createWindowTexture(
  width: number,
  height: number,
  seed: number,
  isNight: boolean,
  tint: string = '#88bbee'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const cols = Math.max(2, Math.floor(width * 4));
  const rows = Math.max(2, Math.floor(height * 3));
  canvas.width = cols * 8;
  canvas.height = rows * 8;
  const ctx = canvas.getContext('2d')!;

  // Wall background
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Windows
  const windowColor = isNight ? '#ffeebb' : '#aaddff';
  const darkWindow = isNight ? '#334455' : '#668899';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rand = seededRandom(seed + r * 100 + c);
      const lit = isNight ? rand > 0.4 : rand > 0.3;
      ctx.fillStyle = lit ? windowColor : darkWindow;
      ctx.fillRect(c * 8 + 1, r * 8 + 1, 6, 6);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

// Color palettes per category
const CATEGORY_COLORS: Record<string, string[]> = {
  residential: ['#7ab87a', '#6aaa6a', '#8cc88c', '#5a9a5a', '#9ad89a'],
  commercial: ['#6688bb', '#5577aa', '#7799cc', '#4466aa', '#88aadd'],
  office: ['#7799bb', '#6688aa', '#88aacc', '#5577aa', '#99bbdd'],
  industrial: ['#bbaa66', '#aa9955', '#ccbb77', '#998844', '#ddcc88'],
  leisure: ['#55bb55', '#44aa44', '#66cc66', '#33aa33', '#77dd77'],
  culture: ['#bb8866', '#aa7755', '#cc9977', '#997744', '#ddaa88'],
  agriculture: ['#66aa44', '#559933', '#77bb55', '#448822', '#88cc66'],
};

function getBuildingColor(type: string, seed: number): string {
  const colors = CATEGORY_COLORS[type] || CATEGORY_COLORS.residential;
  return colors[Math.floor(seededRandom(seed) * colors.length)];
}

// Individual building mesh
function BuildingMesh({ building, isNight }: { building: Building; isNight: boolean }) {
  const map = useGameStore(s => s.map);

  const { position, color, wallTint, buildingHeight, roofType } = useMemo(() => {
    const centerX = building.x + (building.width - 1) / 2;
    const centerZ = building.z + (building.depth - 1) / 2;
    const w = gridToWorld(centerX, centerZ);
    const tile = map[building.x]?.[building.z];
    const h = tile ? getTileWorldHeight(tile) : 0;

    const seed = building.x * 1000 + building.z;
    const col = getBuildingColor(building.type, seed);

    // Building height in world units
    const bh = building.height * 0.15 * building.level;

    // Roof type based on building type
    let roof: 'flat' | 'pitched' | 'tiered' = 'flat';
    if (building.type === 'residential' && building.level <= 2) roof = 'pitched';
    if (building.subtype === 'temple') roof = 'tiered';

    return {
      position: [w.x, h, w.z] as [number, number, number],
      color: col,
      wallTint: col,
      buildingHeight: Math.max(0.2, bh),
      roofType: roof,
    };
  }, [building, map]);

  const seed = building.x * 1000 + building.z;
  const bw = building.width * 0.85;
  const bd = building.depth * 0.85;

  // Window texture for tall buildings
  const windowTex = useMemo(() => {
    if (building.height <= 1 && building.type !== 'commercial') return null;
    return createWindowTexture(building.width, building.height * building.level, seed, isNight, wallTint);
  }, [building, seed, isNight, wallTint]);

  // Cleanup textures
  useEffect(() => {
    return () => { windowTex?.dispose(); };
  }, [windowTex]);

  return (
    <group position={position}>
      {/* Main body */}
      <mesh position={[0, buildingHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[bw, buildingHeight, bd]} />
        {windowTex ? (
          <meshStandardMaterial
            map={windowTex}
            color={color}
            roughness={0.6}
            metalness={0.1}
            emissive={isNight ? '#ffdd88' : '#000000'}
            emissiveIntensity={isNight ? 0.3 : 0}
          />
        ) : (
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.0}
          />
        )}
      </mesh>

      {/* Pitched roof for small residential */}
      {roofType === 'pitched' && (
        <mesh
          position={[0, buildingHeight + 0.08, 0]}
          rotation={[0, seededRandom(seed + 99) > 0.5 ? Math.PI / 2 : 0, 0]}
          castShadow
        >
          <coneGeometry args={[bw * 0.6, 0.15, 4]} />
          <meshStandardMaterial color="#885544" roughness={0.9} />
        </mesh>
      )}

      {/* Tiered roof for temples */}
      {roofType === 'tiered' && (
        <>
          <mesh position={[0, buildingHeight + 0.05, 0]} castShadow>
            <boxGeometry args={[bw * 1.1, 0.05, bd * 1.1]} />
            <meshStandardMaterial color="#554433" roughness={0.8} />
          </mesh>
          <mesh position={[0, buildingHeight + 0.15, 0]} castShadow>
            <boxGeometry args={[bw * 0.8, 0.05, bd * 0.8]} />
            <meshStandardMaterial color="#554433" roughness={0.8} />
          </mesh>
        </>
      )}

      {/* Flat roof structures for office/commercial */}
      {roofType === 'flat' && buildingHeight > 0.5 && building.type === 'office' && (
        <mesh position={[0, buildingHeight + 0.05, 0]} castShadow>
          <boxGeometry args={[bw * 0.3, 0.1, bd * 0.3]} />
          <meshStandardMaterial color="#888888" roughness={0.6} metalness={0.3} />
        </mesh>
      )}

      {/* Ground floor awning for commercial */}
      {building.type === 'commercial' && (
        <mesh position={[0, 0.12, bd / 2 + 0.04]} castShadow>
          <boxGeometry args={[bw * 0.9, 0.02, 0.1]} />
          <meshStandardMaterial
            color={seededRandom(seed + 55) > 0.5 ? '#cc4444' : '#4444cc'}
            roughness={0.5}
          />
        </mesh>
      )}

      {/* Smokestacks for industrial */}
      {building.type === 'industrial' && (
        <>
          <mesh position={[bw * 0.3, buildingHeight + 0.15, bd * 0.2]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 0.3, 6]} />
            <meshStandardMaterial color="#666666" roughness={0.7} metalness={0.4} />
          </mesh>
          {seededRandom(seed + 77) > 0.4 && (
            <mesh position={[-bw * 0.2, buildingHeight + 0.1, -bd * 0.15]} castShadow>
              <cylinderGeometry args={[0.03, 0.04, 0.2, 6]} />
              <meshStandardMaterial color="#777777" roughness={0.7} metalness={0.4} />
            </mesh>
          )}
        </>
      )}

      {/* Agriculture - crop rows (flat green) */}
      {building.type === 'agriculture' && (
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[bw, 0.03, bd]} />
          <meshStandardMaterial color="#88bb44" roughness={0.95} />
        </mesh>
      )}

      {/* Parks - flat with trees */}
      {building.type === 'leisure' && building.subtype === 'park_small' && (
        <>
          <mesh position={[0, 0.01, 0]} receiveShadow>
            <boxGeometry args={[bw, 0.02, bd]} />
            <meshStandardMaterial color="#44cc44" roughness={0.95} />
          </mesh>
          {/* Mini trees */}
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

  const isNight = hour < 6 || hour >= 18;
  const buildingArray = useMemo(() => Array.from(buildings.values()), [buildings]);

  if (buildingArray.length === 0) return null;

  return (
    <group>
      {buildingArray.map(b => (
        <BuildingMesh key={b.id} building={b} isNight={isNight} />
      ))}
    </group>
  );
}
