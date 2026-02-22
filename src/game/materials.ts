import type { GameState } from './types.ts';
import { MATERIAL_PRODUCTION_PER_DAY, MATERIAL_TRANSPORT_RADIUS } from './constants.ts';

/**
 * Process material production from factories and material yards.
 * Called daily from the tick function.
 */
export function processMaterialProduction(state: GameState): void {
  const { subsidiaries, map } = state;

  for (const sub of subsidiaries.values()) {
    if (sub.type === 'factory') {
      // Factory produces materials at its location
      const tile = map[sub.x]?.[sub.z];
      if (tile) {
        tile.materialStock = Math.min(200, tile.materialStock + MATERIAL_PRODUCTION_PER_DAY);
      }
    }
  }
}

/**
 * Get total material stock within radius of a position.
 */
export function getMaterialStockNear(
  x: number, z: number, map: GameState['map'], radius: number = MATERIAL_TRANSPORT_RADIUS
): number {
  let total = 0;
  const minX = Math.max(0, x - radius);
  const maxX = Math.min(map.length - 1, x + radius);
  const minZ = Math.max(0, z - radius);
  const maxZ = Math.min(map[0].length - 1, z + radius);

  for (let ix = minX; ix <= maxX; ix++) {
    for (let iz = minZ; iz <= maxZ; iz++) {
      const dist = Math.sqrt((ix - x) ** 2 + (iz - z) ** 2);
      if (dist <= radius) {
        total += map[ix][iz].materialStock;
      }
    }
  }
  return total;
}

/**
 * Calculate land value for a tile based on station proximity, synergy, and road level.
 */
export function calculateLandValue(
  x: number, z: number, state: GameState
): number {
  const { stations, buildings, map } = state;
  let value = 1;

  // Station proximity bonus
  for (const station of stations.values()) {
    const dist = Math.sqrt((x - station.x) ** 2 + (z - station.z) ** 2);
    if (dist < 15) {
      const proximity = Math.max(0, 1 - dist / 15);
      value += proximity * 50 * (station.activityLevel / 100);
    }
  }

  // Road bonus
  const tile = map[x]?.[z];
  if (tile) {
    value += tile.roadLevel * 5;
  }

  // Industrial penalty
  let industrialNear = 0;
  for (const building of buildings.values()) {
    if (building.type === 'industrial') {
      const dist = Math.sqrt((x - building.x) ** 2 + (z - building.z) ** 2);
      if (dist < 5) industrialNear++;
    }
  }
  value -= industrialNear * 8;

  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Update land values for tiles near stations (called periodically).
 */
export function updateLandValues(state: GameState): void {
  const { stations, map } = state;

  for (const station of stations.values()) {
    const radius = 15;
    const minX = Math.max(0, station.x - radius);
    const maxX = Math.min(map.length - 1, station.x + radius);
    const minZ = Math.max(0, station.z - radius);
    const maxZ = Math.min(map[0].length - 1, station.z + radius);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        map[x][z].landValue = calculateLandValue(x, z, state);
      }
    }
  }
}

/**
 * Generate roads around newly placed buildings.
 * Sets roadLevel on adjacent flat tiles.
 */
export function generateRoads(x: number, z: number, map: GameState['map'], level: number = 1): void {
  const size = map.length;
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dx, dz] of offsets) {
    const nx = x + dx;
    const nz = z + dz;
    if (nx < 0 || nx >= size || nz < 0 || nz >= size) continue;
    const tile = map[nx][nz];
    if (tile.terrain === 'flat' && !tile.buildingId && !tile.stationId && !tile.subsidiaryId) {
      tile.roadLevel = Math.max(tile.roadLevel, level);
    }
  }
}

/**
 * Generate roads around stations with higher level.
 */
export function generateStationRoads(stationX: number, stationZ: number, map: GameState['map']): void {
  const size = map.length;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const nx = stationX + dx;
      const nz = stationZ + dz;
      if (nx < 0 || nx >= size || nz < 0 || nz >= size) continue;
      const tile = map[nx][nz];
      if (tile.terrain === 'flat' && !tile.buildingId && tile.trackIds.length === 0) {
        tile.roadLevel = Math.max(tile.roadLevel, 2);
      }
    }
  }
}
