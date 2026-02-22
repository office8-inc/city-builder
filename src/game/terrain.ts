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

export function generateTerrain(seed: number = 42): MapTile[][] {
  const rng = mulberry32(seed);
  const noise2D = createNoise2D(rng);

  // Helper: multi-octave noise
  function fbm(x: number, z: number, octaves: number, frequency: number, lacunarity: number, gain: number): number {
    let value = 0;
    let amplitude = 1;
    let freq = frequency;
    let totalAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * noise2D(x * freq, z * freq);
      totalAmplitude += amplitude;
      amplitude *= gain;
      freq *= lacunarity;
    }

    return value / totalAmplitude; // normalized to [-1, 1]
  }

  const map: MapTile[][] = [];

  for (let x = 0; x < GRID_SIZE; x++) {
    map[x] = [];
    for (let z = 0; z < GRID_SIZE; z++) {
      // Normalized coordinates
      const nx = x / GRID_SIZE;
      const nz = z / GRID_SIZE;

      // Base height using fbm
      let height = fbm(nx, nz, 6, 3.0, 2.0, 0.5);

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

      // Determine terrain type
      let terrain: TerrainType;
      if (tileHeight <= 1) {
        terrain = 'water';
      } else if (tileHeight >= 8) {
        terrain = 'mountain';
      } else if (tileHeight >= 6) {
        terrain = 'hill';
      } else {
        // Forest noise (separate from height)
        const forestNoise = fbm(nx + 100, nz + 100, 3, 5.0, 2.0, 0.5);
        if (forestNoise > 0.3 && tileHeight >= 3 && tileHeight <= 5) {
          terrain = 'forest';
        } else {
          terrain = 'flat';
        }
      }

      map[x][z] = {
        terrain,
        height: tileHeight,
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
          map[x][z].height = 2;
        }
      }
    }
  }

  // Ensure a large flat area near center for initial building
  const cx = Math.floor(GRID_SIZE / 2);
  const cz = Math.floor(GRID_SIZE / 2);
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

// Get terrain color for rendering — now with per-tile noise variation
export function getTerrainColor(terrain: TerrainType, height: number, tileX?: number, tileZ?: number): [number, number, number] {
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
      // Vary forest between dark green and slightly brownish green
      const v = noise * 0.12;
      return [0.12 + v, 0.42 + noise * 0.08, 0.10 + v * 0.5]; // richer dark green
    }
    case 'flat':
    default: {
      const t = Math.max(0, Math.min(1, (height - 2) / 4));
      // Valleys near water (low height) are darker/richer
      const valleyBoost = height <= 2 ? 0.06 : 0;
      // Occasional subtle dirt patches (less frequent, more natural)
      const isDirt = noise2 > 0.92;
      if (isDirt) {
        return [
          0.38 + (noise - 0.5) * 0.04,
          0.42 + (noise - 0.5) * 0.04,
          0.22 + (noise - 0.5) * 0.03,
        ];
      }
      return [
        0.24 + t * 0.06 + (noise - 0.5) * 0.08 - valleyBoost * 0.5,
        0.62 - t * 0.04 + (noise - 0.5) * 0.06 + valleyBoost,
        0.16 + t * 0.02 + (noise - 0.5) * 0.04,
      ];
    }
  }
}
