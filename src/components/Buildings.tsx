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
  residential: ['#f5f0e8', '#ede4d0', '#f8f2ea', '#fff8f0', '#e8d8c0', '#f0e8d8', '#d8c8b0', '#faf5ee'],
  commercial: ['#ffffff', '#f0f8ff', '#e8f4f8', '#fafafa', '#f5f0e0', '#fff5e8', '#e8f0e8', '#f8f0f0'],
  office: ['#d8dce4', '#c8d0d8', '#e0e4e8', '#b8c8d8', '#ccd4dc', '#d0d8e0', '#e8eaee', '#bcc4d0'],
  industrial: ['#a0a098', '#8a9080', '#b0a898', '#909888', '#98a090', '#a8a098', '#88908a', '#b0a8a0'],
  leisure: ['#88cc88', '#99dd99', '#aaddaa', '#77cc77', '#bbddbb', '#90d090'],
  culture: ['#e8d8c0', '#ddd0b8', '#f0e0c8', '#d0c0a0', '#e0d0b0', '#f5e8d0'],
  agriculture: ['#88bb55', '#99cc66', '#77aa44', '#88bb44', '#99bb55', '#aabb66'],
};

function getBuildingColor(type: string, seed: number): string {
  const colors = CATEGORY_COLORS[type] || CATEGORY_COLORS.residential;
  return colors[Math.floor(seededRandom(seed) * colors.length)];
}

// 高品質ファサードテクスチャ生成
// 業種別パターン、1F店舗、レッジ、窓枠の奥行き表現
const textureCache = new Map<string, THREE.CanvasTexture>();

// 色をやや暗く/明るくするヘルパー
function shadeColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function getSharedWindowTexture(
  category: BuildingCategory,
  variationSeed: number,
  isNight: boolean,
  wallColor: string,
): THREE.CanvasTexture {
  const variationIndex = Math.abs(variationSeed) % 8;
  const key = `${category}_${variationIndex}_${isNight}`;

  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const cols = 5;
  const rows = 10;
  const cellW = 48;
  const cellH = 48;
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext('2d')!;

  // 壁面ベース（微妙なグラデーション）
  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // 壁面のざらつきノイズ
  const wallDark = shadeColor(wallColor, -8);
  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      if (seededRandom(variationIndex * 30000 + y * 200 + x) > 0.7) {
        ctx.fillStyle = wallDark;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }

  // 業種別の窓パターン
  const isOffice = category === 'office';
  const isCommercial = category === 'commercial';
  const isIndustrial = category === 'industrial';

  // 窓サイズ（業種で変わる）
  const winW = isOffice ? cellW - 10 : isCommercial ? cellW - 16 : cellW - 18;
  const winH = isOffice ? cellH - 8 : isCommercial ? cellH - 14 : cellH - 16;
  const winOffX = (cellW - winW) / 2;
  const winOffY = isOffice ? 4 : 8;

  // 窓の色定義
  const glassDay = isOffice ? '#7fafc8' : '#8fbcd8';
  const glassDayDark = isOffice ? '#506878' : '#607888';
  const glassNightLit = '#ffe8a0';
  const glassNightWarm = '#ffd070';
  const glassNightOff = '#1a2838';
  const frameColor = shadeColor(wallColor, -25);

  for (let r = 0; r < rows; r++) {
    const cy = r * cellH;

    // 1F（最下段）は店舗/エントランス
    if (r === rows - 1) {
      if (isCommercial) {
        // 店舗: 大きなショーウィンドウ
        const shopColor = seededRandom(variationSeed + 500) > 0.5 ? '#e8d8c0' : '#d0c0a8';
        ctx.fillStyle = shopColor;
        ctx.fillRect(0, cy, canvas.width, cellH);
        // ショーウィンドウ
        for (let c = 0; c < cols; c++) {
          const cx = c * cellW;
          ctx.fillStyle = isNight ? '#ffeecc' : '#a8d4e8';
          ctx.fillRect(cx + 4, cy + 6, cellW - 8, cellH - 14);
          // 窓枠
          ctx.strokeStyle = '#404040';
          ctx.lineWidth = 2;
          ctx.strokeRect(cx + 4, cy + 6, cellW - 8, cellH - 14);
          // 中央仕切り
          ctx.beginPath();
          ctx.moveTo(cx + cellW / 2, cy + 6);
          ctx.lineTo(cx + cellW / 2, cy + cellH - 8);
          ctx.stroke();
        }
        // 庇ライン
        ctx.fillStyle = '#555555';
        ctx.fillRect(0, cy, canvas.width, 3);
      } else {
        // エントランス（住宅/オフィス）
        ctx.fillStyle = shadeColor(wallColor, -15);
        ctx.fillRect(0, cy, canvas.width, cellH);
        // ドア
        const doorC = Math.floor(cols / 2);
        const dx = doorC * cellW;
        ctx.fillStyle = '#3a3020';
        ctx.fillRect(dx + 10, cy + 10, cellW - 20, cellH - 12);
        ctx.strokeStyle = '#555545';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx + 10, cy + 10, cellW - 20, cellH - 12);
        // 他はガレージや小窓
        for (let c = 0; c < cols; c++) {
          if (c === doorC) continue;
          const cx = c * cellW;
          ctx.fillStyle = isNight ? glassNightOff : glassDayDark;
          ctx.fillRect(cx + 12, cy + 16, cellW - 24, cellH - 24);
        }
      }
      continue;
    }

    // フロア間レッジ（コーニス）
    ctx.fillStyle = shadeColor(wallColor, -18);
    ctx.fillRect(0, cy + cellH - 3, canvas.width, 3);

    // 各窓
    for (let c = 0; c < cols; c++) {
      const cx = c * cellW;
      const rand = seededRandom(variationIndex * 10000 + r * 100 + c);

      // 窓枠（奥まった影の表現）
      ctx.fillStyle = frameColor;
      ctx.fillRect(cx + winOffX - 2, cy + winOffY - 2, winW + 4, winH + 4);

      // ガラス
      if (isNight) {
        const lit = rand > 0.3;
        ctx.fillStyle = lit
          ? (rand > 0.65 ? glassNightWarm : glassNightLit)
          : glassNightOff;
      } else {
        // 昼: 空の反射 + ランダムにブラインド/カーテン
        if (rand > 0.8) {
          ctx.fillStyle = glassDayDark; // ブラインド閉
        } else if (rand > 0.6) {
          // 半開きブラインド
          ctx.fillStyle = glassDay;
          ctx.fillRect(cx + winOffX, cy + winOffY, winW, winH);
          ctx.fillStyle = glassDayDark;
          ctx.fillRect(cx + winOffX, cy + winOffY, winW, winH * 0.4);
          continue;
        } else {
          ctx.fillStyle = glassDay;
        }
      }
      ctx.fillRect(cx + winOffX, cy + winOffY, winW, winH);

      // オフィス: 横桟（カーテンウォール風）
      if (isOffice && winW > 20) {
        ctx.fillStyle = frameColor;
        ctx.fillRect(cx + winOffX, cy + winOffY + winH * 0.5 - 1, winW, 2);
        // 縦桟
        const midX = cx + winOffX + winW / 2;
        ctx.fillRect(midX - 1, cy + winOffY, 2, winH);
      }

      // 住宅: 十字窓桟
      if (category === 'residential') {
        ctx.fillStyle = frameColor;
        ctx.fillRect(cx + winOffX + winW / 2 - 1, cy + winOffY, 2, winH);
        ctx.fillRect(cx + winOffX, cy + winOffY + winH / 2 - 1, winW, 2);
      }

      // 窓台（窓下の出っ張り）
      if (!isOffice && !isIndustrial) {
        ctx.fillStyle = shadeColor(wallColor, 15);
        ctx.fillRect(cx + winOffX - 2, cy + winOffY + winH, winW + 4, 3);
      }
    }
  }

  // 上端のパラペット/コーニス
  ctx.fillStyle = shadeColor(wallColor, -22);
  ctx.fillRect(0, 0, canvas.width, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
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

    // レジャー・農業は高さを制限（公園/畑は高層にならない）
    let finalH = Math.max(0.2, bh);
    if (building.type === 'leisure') finalH = Math.min(finalH, 0.15);
    if (building.type === 'agriculture') finalH = Math.min(finalH, 0.08);
    if (building.type === 'culture') finalH = Math.max(finalH, 0.3); // 文化施設は最低限の高さ

    let roof: 'flat' | 'pitched' | 'tiered' | 'dome' = 'flat';
    if (building.type === 'residential' && building.level <= 2) roof = 'pitched';
    if (building.subtype === 'temple') roof = 'tiered';
    if (building.type === 'culture') roof = 'dome';

    return {
      position: [w.x, h, w.z] as [number, number, number],
      color: col,
      buildingHeight: finalH,
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

  // ポディウム＋タワー構造 or セットバック（高い建物のみ）
  const buildingParts = useMemo(() => {
    if (buildingHeight < 0.5 || building.level < 3) return null;
    const variant = seededRandom(seed + 777);

    if (building.type === 'office' && buildingHeight > 0.8) {
      // オフィス: ポディウム（基壇3F程度）＋スリムタワー
      const podiumH = Math.min(buildingHeight * 0.3, 0.35);
      const towerH = buildingHeight - podiumH;
      return {
        type: 'podium_tower' as const,
        podium: { y: podiumH / 2, h: podiumH, wScale: 1.0 },
        tower: { y: podiumH + towerH / 2, h: towerH, wScale: 0.72 + variant * 0.1 },
        // タワーのオフセット（中心からずらす）
        towerOffset: variant > 0.5 ? bw * 0.08 : -bw * 0.08,
      };
    }

    if (building.type === 'residential' && buildingHeight > 0.7) {
      // 住宅: 段々セットバック（2-3段）
      const levels = Math.min(3, Math.floor(buildingHeight / 0.35));
      if (levels < 2) return null;
      const parts: { y: number; h: number; wScale: number }[] = [];
      let cumH = 0;
      for (let i = 0; i < levels; i++) {
        const lh = buildingHeight / levels;
        parts.push({ y: cumH + lh / 2, h: lh, wScale: 1.0 - i * 0.1 });
        cumH += lh;
      }
      return { type: 'setback' as const, parts };
    }

    if (building.type === 'commercial' && buildingHeight > 0.6) {
      // 商業: 低層ワイド（2F商業施設）＋上層住居/オフィス
      const baseH = buildingHeight * 0.35;
      const upperH = buildingHeight - baseH;
      return {
        type: 'setback' as const,
        parts: [
          { y: baseH / 2, h: baseH, wScale: 1.0 },
          { y: baseH + upperH / 2, h: upperH, wScale: 0.85 },
        ],
      };
    }

    return null;
  }, [buildingHeight, building.level, building.type, seed, bw]);

  // バルコニー判定
  const hasBalcony = building.type === 'residential' && building.level >= 3 && buildingHeight > 0.6;
  const balconySide = seededRandom(seed + 333) > 0.5 ? 1 : -1;

  // Simple LOD: colored box with slight base
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

  const wallMat = windowTex ? (
    <meshStandardMaterial
      map={windowTex}
      color={color}
      roughness={0.55}
      metalness={building.type === 'office' ? 0.35 : 0.1}
      emissive={isNight ? '#ffdd88' : '#000000'}
      emissiveIntensity={isNight ? 0.4 : 0}
      emissiveMap={isNight ? windowTex : undefined}
    />
  ) : (
    <meshStandardMaterial color={color} roughness={0.8} metalness={0.0} />
  );

  return (
    <group position={position}>
      {/* 基壇部分（1F部分を少し広げる） */}
      {buildingHeight > 0.4 && building.type !== 'agriculture' && building.type !== 'leisure' && (
        <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[bw * 1.04, 0.08, bd * 1.04]} />
          <meshStandardMaterial color="#888888" roughness={0.7} metalness={0.1} />
        </mesh>
      )}

      {/* メインボディ（レジャー/農業は専用レンダリングで描画するため省略） */}
      {building.type !== 'leisure' && building.type !== 'agriculture' && (
        buildingParts?.type === 'podium_tower' ? (
          <>
            {/* ポディウム（基壇） */}
            <mesh position={[0, buildingParts.podium.y, 0]} castShadow receiveShadow>
              <boxGeometry args={[bw, buildingParts.podium.h, bd]} />
              {wallMat}
            </mesh>
            {/* タワー（スリム、オフセット付き） */}
            <mesh
              position={[buildingParts.towerOffset, buildingParts.tower.y, 0]}
              castShadow receiveShadow
            >
              <boxGeometry args={[bw * buildingParts.tower.wScale, buildingParts.tower.h, bd * buildingParts.tower.wScale]} />
              {wallMat}
            </mesh>
          </>
        ) : buildingParts?.type === 'setback' ? (
          buildingParts.parts.map((sb, i) => (
            <mesh key={i} position={[0, sb.y, 0]} castShadow receiveShadow>
              <boxGeometry args={[bw * sb.wScale, sb.h, bd * sb.wScale]} />
              {wallMat}
            </mesh>
          ))
        ) : (
          <mesh position={[0, buildingHeight / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[bw, buildingHeight, bd]} />
            {wallMat}
          </mesh>
        )
      )}

      {/* バルコニー（マンション用） */}
      {hasBalcony && (
        <>
          {Array.from({ length: Math.min(4, Math.floor(buildingHeight / 0.2)) }, (_, i) => (
            <group key={`bal${i}`}>
              <mesh
                position={[balconySide * (bw / 2 + 0.025), 0.15 + i * 0.22, 0]}
                castShadow
              >
                <boxGeometry args={[0.05, 0.015, bd * 0.7]} />
                <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.2} />
              </mesh>
              {/* 手すり */}
              <mesh
                position={[balconySide * (bw / 2 + 0.05), 0.17 + i * 0.22, 0]}
              >
                <boxGeometry args={[0.008, 0.04, bd * 0.7]} />
                <meshStandardMaterial color="#999999" roughness={0.4} metalness={0.4} transparent opacity={0.7} />
              </mesh>
            </group>
          ))}
        </>
      )}

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
          {/* 給水タンク */}
          <mesh position={[bw * 0.25, buildingHeight + 0.08, bd * 0.15]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.12, 8]} />
            <meshStandardMaterial color="#778899" roughness={0.4} metalness={0.5} />
          </mesh>
          {/* 給水タンク脚 */}
          <mesh position={[bw * 0.25, buildingHeight + 0.015, bd * 0.15]} castShadow>
            <boxGeometry args={[0.06, 0.03, 0.06]} />
            <meshStandardMaterial color="#666666" roughness={0.5} metalness={0.4} />
          </mesh>
          {/* AC室外機 */}
          <mesh position={[-bw * 0.2, buildingHeight + 0.04, -bd * 0.2]} castShadow>
            <boxGeometry args={[0.1, 0.06, 0.08]} />
            <meshStandardMaterial color="#889999" roughness={0.5} metalness={0.3} />
          </mesh>
          {/* 屋上フェンス（パラペット） */}
          <mesh position={[0, buildingHeight + 0.015, 0]}>
            <boxGeometry args={[bw + 0.02, 0.03, bd + 0.02]} />
            <meshStandardMaterial color="#aaaaaa" roughness={0.6} metalness={0.2} />
          </mesh>
        </>
      )}

      {/* === OFFICE: 屋上設備（バリエーション付き） === */}
      {building.type === 'office' && buildingHeight > 0.3 && (
        <>
          {/* 屋上パラペット */}
          <mesh position={[0, buildingHeight + 0.008, 0]}>
            <boxGeometry args={[bw + 0.02, 0.016, bd + 0.02]} />
            <meshStandardMaterial color="#606870" roughness={0.3} metalness={0.5} />
          </mesh>

          {/* バリエーション分岐 */}
          {seededRandom(seed + 444) > 0.6 ? (
            /* ヘリパッド付き高層 */
            <>
              <mesh position={[0, buildingHeight + 0.02, 0]} receiveShadow>
                <cylinderGeometry args={[bw * 0.3, bw * 0.3, 0.01, 16]} />
                <meshStandardMaterial color="#555555" roughness={0.7} />
              </mesh>
              {/* H マーク */}
              <mesh position={[0, buildingHeight + 0.028, 0]}>
                <boxGeometry args={[bw * 0.12, 0.002, bw * 0.04]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>
              <mesh position={[bw * 0.04, buildingHeight + 0.028, 0]}>
                <boxGeometry args={[bw * 0.04, 0.002, bw * 0.2]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>
              <mesh position={[-bw * 0.04, buildingHeight + 0.028, 0]}>
                <boxGeometry args={[bw * 0.04, 0.002, bw * 0.2]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>
            </>
          ) : seededRandom(seed + 444) > 0.3 ? (
            /* ガラスクラウン + アンテナ */
            <>
              <mesh position={[0, buildingHeight + 0.04, 0]} castShadow>
                <boxGeometry args={[bw * 0.88, 0.06, bd * 0.88]} />
                <meshStandardMaterial color="#506880" roughness={0.15} metalness={0.7} />
              </mesh>
              {buildingHeight > 0.8 && (
                <>
                  <mesh position={[0, buildingHeight + 0.25, 0]} castShadow>
                    <cylinderGeometry args={[0.008, 0.015, 0.4, 4]} />
                    <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.8} />
                  </mesh>
                  <mesh position={[0, buildingHeight + 0.46, 0]}>
                    <sphereGeometry args={[0.015, 6, 6]} />
                    <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={isNight ? 2.0 : 0.3} />
                  </mesh>
                </>
              )}
            </>
          ) : (
            /* 機械室（ペントハウス） */
            <>
              <mesh position={[bw * 0.15, buildingHeight + 0.05, 0]} castShadow>
                <boxGeometry args={[bw * 0.4, 0.08, bd * 0.5]} />
                <meshStandardMaterial color="#889898" roughness={0.6} metalness={0.3} />
              </mesh>
              <mesh position={[-bw * 0.2, buildingHeight + 0.04, bd * 0.15]} castShadow>
                <boxGeometry args={[0.08, 0.06, 0.08]} />
                <meshStandardMaterial color="#888888" roughness={0.6} metalness={0.3} />
              </mesh>
            </>
          )}
        </>
      )}

      {/* === COMMERCIAL: 庇 + エントランス === */}
      {building.type === 'commercial' && (
        <>
          {/* エントランス暗部 */}
          <mesh position={[0, 0.08, bd / 2 + 0.001]}>
            <planeGeometry args={[bw * 0.6, 0.14]} />
            <meshStandardMaterial color="#333333" roughness={0.9} />
          </mesh>
          {/* 庇（メイン） */}
          <mesh position={[0, 0.16, bd / 2 + 0.06]} castShadow>
            <boxGeometry args={[bw * 0.85, 0.02, 0.12]} />
            <meshStandardMaterial
              color={seededRandom(seed + 55) > 0.5 ? '#cc3333' : '#3366aa'}
              roughness={0.5}
            />
          </mesh>
          {/* 看板（上部） */}
          {buildingHeight > 0.3 && (
            <mesh position={[0, buildingHeight * 0.85, bd / 2 + 0.005]}>
              <planeGeometry args={[bw * 0.7, 0.08]} />
              <meshStandardMaterial
                color={seededRandom(seed + 111) > 0.5 ? '#ee4444' : '#2255cc'}
                emissive={isNight ? '#ffaa44' : '#000000'}
                emissiveIntensity={isNight ? 0.6 : 0}
                roughness={0.4}
              />
            </mesh>
          )}
          {/* 裏側庇 */}
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

      {/* === INDUSTRIAL: 煙突 + クレーン === */}
      {building.type === 'industrial' && (
        <>
          <mesh position={[bw * 0.3, buildingHeight + 0.18, bd * 0.2]} castShadow>
            <cylinderGeometry args={[0.04, 0.055, 0.35, 8]} />
            <meshStandardMaterial color="#555555" roughness={0.6} metalness={0.5} />
          </mesh>
          {/* 煙突トップ */}
          <mesh position={[bw * 0.3, buildingHeight + 0.36, bd * 0.2]}>
            <cylinderGeometry args={[0.05, 0.04, 0.02, 8]} />
            <meshStandardMaterial color="#444444" roughness={0.5} metalness={0.5} />
          </mesh>
          {seededRandom(seed + 77) > 0.4 && (
            <mesh position={[-bw * 0.2, buildingHeight + 0.12, -bd * 0.15]} castShadow>
              <cylinderGeometry args={[0.03, 0.04, 0.24, 8]} />
              <meshStandardMaterial color="#666666" roughness={0.6} metalness={0.5} />
            </mesh>
          )}
          {/* パイプライン */}
          {buildingHeight > 0.3 && (
            <mesh position={[-bw / 2 - 0.02, buildingHeight * 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.015, 0.015, bd * 0.6, 6]} />
              <meshStandardMaterial color="#777777" roughness={0.4} metalness={0.6} />
            </mesh>
          )}
        </>
      )}

      {/* === AGRICULTURE: 畑の畝 === */}
      {building.type === 'agriculture' && (
        <>
          <mesh position={[0, 0.02, 0]} receiveShadow>
            <boxGeometry args={[bw, 0.03, bd]} />
            <meshStandardMaterial color="#88bb44" roughness={0.95} />
          </mesh>
          {/* 畝の筋 */}
          {Array.from({ length: 4 }, (_, i) => (
            <mesh key={`row${i}`} position={[(i - 1.5) * bw * 0.25, 0.04, 0]} receiveShadow>
              <boxGeometry args={[0.02, 0.02, bd * 0.9]} />
              <meshStandardMaterial color="#6a9930" roughness={0.95} />
            </mesh>
          ))}
        </>
      )}

      {/* === LEISURE: 公園・レクリエーション施設 === */}
      {building.type === 'leisure' && (
        <>
          {/* 芝生ベース */}
          <mesh position={[0, 0.01, 0]} receiveShadow>
            <boxGeometry args={[bw, 0.02, bd]} />
            <meshStandardMaterial color="#55bb55" roughness={0.95} />
          </mesh>
          {/* 遊歩道 */}
          <mesh position={[0, 0.025, 0]}>
            <boxGeometry args={[0.06, 0.005, bd * 0.8]} />
            <meshStandardMaterial color="#c8b898" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.025, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.06, 0.005, bw * 0.6]} />
            <meshStandardMaterial color="#c8b898" roughness={0.9} />
          </mesh>
          {/* 樹木 */}
          <mesh position={[bw * 0.25, 0.12, bd * 0.2]} castShadow>
            <icosahedronGeometry args={[0.09, 1]} />
            <meshStandardMaterial color="#228822" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[bw * 0.25, 0.04, bd * 0.2]} castShadow>
            <cylinderGeometry args={[0.012, 0.015, 0.06, 4]} />
            <meshStandardMaterial color="#6b4226" roughness={0.9} />
          </mesh>
          <mesh position={[-bw * 0.2, 0.1, -bd * 0.25]} castShadow>
            <icosahedronGeometry args={[0.07, 1]} />
            <meshStandardMaterial color="#22aa22" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[-bw * 0.2, 0.035, -bd * 0.25]} castShadow>
            <cylinderGeometry args={[0.01, 0.013, 0.05, 4]} />
            <meshStandardMaterial color="#6b4226" roughness={0.9} />
          </mesh>
          {/* ベンチ */}
          <mesh position={[bw * 0.05, 0.035, bd * 0.3]}>
            <boxGeometry args={[0.08, 0.015, 0.03]} />
            <meshStandardMaterial color="#8b6914" roughness={0.8} />
          </mesh>
          {/* フェンス/外周 */}
          <mesh position={[0, 0.035, bd / 2]}>
            <boxGeometry args={[bw, 0.025, 0.01]} />
            <meshStandardMaterial color="#889988" roughness={0.6} metalness={0.3} transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 0.035, -bd / 2]}>
            <boxGeometry args={[bw, 0.025, 0.01]} />
            <meshStandardMaterial color="#889988" roughness={0.6} metalness={0.3} transparent opacity={0.6} />
          </mesh>
        </>
      )}

      {/* === CULTURE: ドーム屋根 + 柱 === */}
      {roofType === 'dome' && (
        <>
          {/* ドーム */}
          <mesh position={[0, buildingHeight + 0.03, 0]} castShadow>
            <sphereGeometry args={[bw * 0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#c8a878" roughness={0.6} metalness={0.15} />
          </mesh>
          {/* エントランス柱 */}
          {[[-bw * 0.3, bd / 2 + 0.03], [bw * 0.3, bd / 2 + 0.03]].map(([px, pz], i) => (
            <mesh key={`col${i}`} position={[px, buildingHeight * 0.5, pz]} castShadow>
              <cylinderGeometry args={[0.02, 0.025, buildingHeight, 6]} />
              <meshStandardMaterial color="#e0d0b8" roughness={0.5} />
            </mesh>
          ))}
          {/* ペディメント（三角屋根） */}
          <mesh position={[0, buildingHeight + 0.02, bd / 2 + 0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[bw * 0.45, 0.15, 3]} />
            <meshStandardMaterial color="#e0d0b8" roughness={0.6} />
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
