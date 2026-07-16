import { createNoise2D } from 'simplex-noise';
import type { MapTile, TerrainType } from './types.ts';
import { GRID_SIZE } from './constants.ts';

// Seeded PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 動径バイアス: マップ中心からの距離に応じて0(中心)→1(外周)へ滑らかに増加する係数。
// centerRadius以内は常に0（丘陵・山岳を出現させない＝都市開発の中心地を保証）、
// edgeRadius以遠は1（丘陵・山岳が出現しやすい＝外周部に偏らせる）。
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// GAME_DESIGN.md 2.1節: マップ中央部（半径約40タイル）は平野を保証する動径バイアスを適用し、
// 中心から離れるほど丘陵・山岳が出現しやすくする（山岳はマップ外周部に偏る）。
const CENTER_FLAT_RADIUS = 40;
const EDGE_BIAS_RADIUS = 62;
// 地形種別の閾値（scratchpadでシード42/101/202/303/7/999を用いて検証し、
// 陸地（非水域）に対する割合が目安: 平地65-75% / 丘陵10-15% / 山岳5-10% / 森林8-12% に収まるよう調整済み）
const MOUNTAIN_THRESHOLD = 0.56;
const HILL_THRESHOLD = 0.40;
const FOREST_THRESHOLD = 0.68;

// combined値（0-1）を高さ（2-10）へ区分的線形マッピングする。
// [0, HILL_THRESHOLD] → 2-6（平地）, [HILL_THRESHOLD, MOUNTAIN_THRESHOLD] → 6-8（丘陵）,
// [MOUNTAIN_THRESHOLD, 1] → 8-10（山岳）。区間の境界で連続（同じ値）になるよう定義し、
// 各区間の幅をgetTerrainColorの色正規化（flat: (height-2)/4, hill: (height-6)/2,
// mountain: (height-8)/2）が前提とする範囲とそろえている
function heightFromCombined(combinedForHeight: number): number {
  if (combinedForHeight <= HILL_THRESHOLD) {
    const t = combinedForHeight / HILL_THRESHOLD;
    return Math.round(2 + t * 4);
  } else if (combinedForHeight <= MOUNTAIN_THRESHOLD) {
    const t = (combinedForHeight - HILL_THRESHOLD) / (MOUNTAIN_THRESHOLD - HILL_THRESHOLD);
    return Math.round(6 + t * 2);
  } else {
    const t = Math.min(1, (combinedForHeight - MOUNTAIN_THRESHOLD) / (1 - MOUNTAIN_THRESHOLD));
    return Math.round(8 + t * 2);
  }
}

export function generateTerrain(seed: number = 42): MapTile[][] {
  const rng = mulberry32(seed);
  const noise2D = createNoise2D(rng);
  // 丘陵・山岳の起伏（ruggedness）用と森林の群生パターン用に、
  // 高さ・川生成とは独立した別のノイズチャンネルを使う（互いの模様が相関しないように種をずらす）
  const noise2DRugged = createNoise2D(mulberry32(seed + 777));
  const noise2DForest = createNoise2D(mulberry32(seed + 1234));

  // Helper: multi-octave noise
  function fbm(fn: (x: number, z: number) => number, x: number, z: number, octaves: number, frequency: number, lacunarity: number, gain: number): number {
    let value = 0;
    let amplitude = 1;
    let freq = frequency;
    let totalAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * fn(x * freq, z * freq);
      totalAmplitude += amplitude;
      amplitude *= gain;
      freq *= lacunarity;
    }

    return value / totalAmplitude; // normalized to [-1, 1]
  }

  const map: MapTile[][] = [];
  const cx = GRID_SIZE / 2;
  const cz = GRID_SIZE / 2;

  for (let x = 0; x < GRID_SIZE; x++) {
    map[x] = [];
    for (let z = 0; z < GRID_SIZE; z++) {
      // Normalized coordinates
      const nx = x / GRID_SIZE;
      const nz = z / GRID_SIZE;

      // Base height using fbm
      let height = fbm(noise2D, nx, nz, 6, 3.0, 2.0, 0.5);

      // Remap from [-1,1] to [0,1]
      height = (height + 1) / 2;

      // Edge falloff - lower terrain near map edges to create a natural boundary
      const edgeX = Math.min(x, GRID_SIZE - 1 - x) / (GRID_SIZE * 0.15);
      const edgeZ = Math.min(z, GRID_SIZE - 1 - z) / (GRID_SIZE * 0.15);
      const edgeFactor = Math.min(1, Math.min(edgeX, edgeZ));
      height *= edgeFactor;

      // Add a river using a separate noise channel
      const riverNoise = noise2D(nx * 2.0, nz * 8.0);
      const riverCenter = 0.5 + noise2D(nz * 3.0, 0.5) * 0.15;
      const distFromRiver = Math.abs(nx - riverCenter);
      const riverWidth = 0.02 + Math.abs(riverNoise) * 0.01;
      if (distFromRiver < riverWidth) {
        height *= 0.1; // Flatten river area
      }

      // Map height to 0-10 scale
      const tileHeight = Math.round(height * 10);

      let terrain: TerrainType;
      let tileFieldHeight: number;

      if (tileHeight <= 1) {
        terrain = 'water';
        tileFieldHeight = tileHeight;
      } else {
        // 動径バイアス: 中心から近いほど0（平野保証）、外周に近いほど1に近づく
        const dist = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
        const radialBias = smoothstep(CENTER_FLAT_RADIUS, EDGE_BIAS_RADIUS, dist);

        // 丘陵・山岳の起伏ノイズ（0-1に正規化）。動径バイアスと掛け合わせることで
        // 「起伏が強い場所」かつ「中心から離れた場所」でのみ丘陵・山岳が出現する
        const ruggedness = (fbm(noise2DRugged, nx, nz, 4, 1.5, 2.0, 0.5) + 1) / 2;
        const combined = ruggedness * radialBias;

        if (combined > MOUNTAIN_THRESHOLD) {
          terrain = 'mountain';
        } else if (combined > HILL_THRESHOLD) {
          terrain = 'hill';
        } else {
          terrain = 'flat';
        }

        // 高さはcombinedの区分的線形（平地2-6→丘陵6-8→山岳8-10）で決める。
        // 各区間の境界（HILL_THRESHOLD/MOUNTAIN_THRESHOLD）でちょうど同じ高さになるよう
        // 継ぎ目なく接続するため、地形タイプが切り替わる境界タイル同士でも高さの段差が
        // 生まれない（線路はTracks.tsxが2タイル間の平均高さに水平に置くだけで傾斜をつけない
        // ため、平地/丘陵/山岳の境界で線路や建物が地形に浮く/めり込む見た目を防ぐ）。
        // かつ各区間の高さ幅をgetTerrainColorが前提とする範囲（平地2-6, 丘陵6-8, 山岳8-10）と
        // 一致させることで、tから導く色の正規化もそのまま有効にする
        const combinedForHeight = Math.max(combined, height * HILL_THRESHOLD);
        tileFieldHeight = heightFromCombined(combinedForHeight);
      }

      map[x][z] = {
        terrain,
        height: tileFieldHeight,
        trackIds: [],
        buildingId: null,
        stationId: null,
        subsidiaryId: null,
        landValue: 0,
        materialStock: 0,
        roadLevel: 0,
      };
    }
  }

  // Post-process: ensure water bodies are connected and natural
  // Smooth small isolated water tiles
  for (let x = 1; x < GRID_SIZE - 1; x++) {
    for (let z = 1; z < GRID_SIZE - 1; z++) {
      if (map[x][z].terrain === 'water') {
        let waterNeighbors = 0;
        for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          if (map[x + dx][z + dz].terrain === 'water') waterNeighbors++;
        }
        // Remove isolated water tiles
        if (waterNeighbors === 0) {
          map[x][z].terrain = 'flat';
          // 昇格後の高さは固定値ではなく周囲タイルの高さの平均にする。
          // isolated判定＝隣接4タイルはすべて非水域なので、その平均を使えば
          // 高さが常に有効（例えば隣が丘陵ならその高さに近い値になり、丘陵の隣に
          // 高さ2の平地が孤立して段差になる、というContinuity崩れを防げる）
          let sum = 0;
          let count = 0;
          for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const neighbor = map[x + dx]?.[z + dz];
            if (neighbor) { sum += neighbor.height; count++; }
          }
          map[x][z].height = count > 0 ? Math.round(sum / count) : 2;
        }
      }
    }
  }

  // 森林: 平地タイルの一部に群生させる（水域・丘陵・山岳には生成しない）。
  // 高さ・起伏とは別の低周波ノイズでクラスタ状に分布させる。
  // ただし中心付近（駅の最大影響半径15タイル、cityDevelopment.tsのradius上限と同じ）は
  // 森林を除外し、序盤に駅を建ててすぐ自動発展できる連続した平地を保証する
  // （丘陵・山岳のCENTER_FLAT_RADIUSより狭くし、森林本来の「平地に群生する」分布は維持する）
  const FOREST_CENTER_RADIUS = 15;
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      if (map[x][z].terrain !== 'flat') continue;
      const dist = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
      if (dist < FOREST_CENTER_RADIUS) continue;
      const nx = x / GRID_SIZE;
      const nz = z / GRID_SIZE;
      const forestNoise = (fbm(noise2DForest, nx, nz, 3, 4.0, 2.0, 0.5) + 1) / 2;
      if (forestNoise > FOREST_THRESHOLD) {
        map[x][z].terrain = 'forest';
      }
    }
  }

  // Ensure a large flat area near center for initial building
  // （森林・丘陵・山岳の判定より後に適用し、初期プレイエリアを確実に平地にする）
  const flatRadius = 8;
  for (let x = cx - flatRadius; x <= cx + flatRadius; x++) {
    for (let z = cz - flatRadius; z <= cz + flatRadius; z++) {
      if (x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE) {
        const dist = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
        if (dist <= flatRadius) {
          map[x][z].terrain = 'flat';
          map[x][z].height = 3;
        }
      }
    }
  }

  return map;
}

// Get the world-space height for a tile
export function getTileWorldHeight(tile: MapTile): number {
  if (tile.terrain === 'water') return -0.15;
  return tile.height * 0.15; // Scale height to world units
}

// Simple hash for per-tile color variation (no extra dependency)
function tileHash(x: number, z: number): number {
  let h = (x * 374761393 + z * 668265263 + 13) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296; // 0..1
}

// Get terrain color for rendering — now with per-tile noise variation and seasonal colors
export function getTerrainColor(terrain: TerrainType, height: number, tileX?: number, tileZ?: number, season?: string): [number, number, number] {
  const noise = (tileX !== undefined && tileZ !== undefined) ? tileHash(tileX, tileZ) : 0.5;
  // Secondary noise at different frequency for dirt patches
  const noise2 = (tileX !== undefined && tileZ !== undefined) ? tileHash(tileX + 317, tileZ + 523) : 0.5;

  switch (terrain) {
    case 'water':
      return [0.10, 0.37, 0.65]; // deeper blue
    case 'mountain': {
      const t = (height - 8) / 2;
      // Gray/rocky mountain tops with slight variation
      return [
        0.48 + t * 0.12 + (noise - 0.5) * 0.06,
        0.47 + t * 0.10 + (noise - 0.5) * 0.05,
        0.44 + t * 0.10 + (noise - 0.5) * 0.04,
      ];
    }
    case 'hill': {
      const t = (height - 6) / 2;
      // Richer greens with some brown rocky patches at higher parts
      const rocky = t > 0.6 ? (t - 0.6) * 0.5 : 0;
      return [
        0.35 + t * 0.08 + rocky * 0.15 + (noise - 0.5) * 0.06,
        0.52 + t * 0.03 - rocky * 0.1 + (noise - 0.5) * 0.05,
        0.25 + t * 0.04 + rocky * 0.05 + (noise - 0.5) * 0.04,
      ];
    }
    case 'forest': {
      const v = noise * 0.12;
      if (season === 'autumn') {
        // Red/orange/brown autumn leaves
        const r = 0.55 + v + noise * 0.15;
        const g = 0.25 + noise * 0.1;
        const b = 0.08 + v * 0.3;
        return [r, g, b];
      }
      if (season === 'winter') {
        // Bare/snowy forest
        return [0.5 + v * 0.5, 0.52 + noise * 0.04, 0.48 + v * 0.3];
      }
      if (season === 'spring') {
        // Light green with pink cherry blossom hints
        const pink = noise > 0.7 ? 0.15 : 0;
        return [0.2 + v + pink, 0.5 + noise * 0.08, 0.18 + v * 0.5 + pink * 0.3];
      }
      // Summer (default) - rich dark green
      return [0.12 + v, 0.42 + noise * 0.08, 0.10 + v * 0.5];
    }
    case 'flat':
    default: {
      const t = Math.max(0, Math.min(1, (height - 2) / 4));
      const valleyBoost = height <= 2 ? 0.06 : 0;
      const isDirt = noise2 > 0.92;
      if (isDirt) {
        return [
          0.38 + (noise - 0.5) * 0.04,
          0.42 + (noise - 0.5) * 0.04,
          0.22 + (noise - 0.5) * 0.03,
        ];
      }
      // Seasonal flat ground colors
      let rBase = 0.24, gBase = 0.62, bBase = 0.16;
      if (season === 'autumn') {
        rBase = 0.35; gBase = 0.48; bBase = 0.15;
      } else if (season === 'winter') {
        rBase = 0.55; gBase = 0.58; bBase = 0.52;
      } else if (season === 'spring') {
        rBase = 0.28; gBase = 0.65; bBase = 0.22;
      }
      return [
        rBase + t * 0.06 + (noise - 0.5) * 0.08 - valleyBoost * 0.5,
        gBase - t * 0.04 + (noise - 0.5) * 0.06 + valleyBoost,
        bBase + t * 0.02 + (noise - 0.5) * 0.04,
      ];
    }
  }
}
