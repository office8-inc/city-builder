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
 * Check if a tile can have a road placed on it.
 */
function canPlaceRoad(nx: number, nz: number, map: GameState['map']): boolean {
  const size = map.length;
  if (nx < 0 || nx >= size || nz < 0 || nz >= size) return false;
  const tile = map[nx][nz];
  return tile.terrain === 'flat' && !tile.buildingId && !tile.stationId && !tile.subsidiaryId && tile.trackIds.length === 0;
}

/**
 * Generate roads around newly placed buildings.
 * Places adjacent roads AND extends them to connect to nearby existing roads,
 * creating a connected road network instead of scattered isolated tiles.
 */
export function generateRoads(x: number, z: number, map: GameState['map'], level: number = 1): void {
  const size = map.length;
  const adjacentOffsets: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const placedRoads: [number, number][] = [];

  // Step 1: Place roads on adjacent tiles (existing behavior)
  for (const [dx, dz] of adjacentOffsets) {
    const nx = x + dx;
    const nz = z + dz;
    if (canPlaceRoad(nx, nz, map)) {
      map[nx][nz].roadLevel = Math.max(map[nx][nz].roadLevel, level);
      placedRoads.push([nx, nz]);
    }
  }

  // Step 2: From each newly placed road, extend in its cardinal direction
  // to connect to existing roads (up to 8 tiles away)
  const MAX_EXTEND = 8;
  for (const [rx, rz] of placedRoads) {
    const dx = rx - x; // direction away from building
    const dz = rz - z;

    // Search in this direction for existing road
    let foundRoad = false;
    for (let dist = 1; dist <= MAX_EXTEND; dist++) {
      const tx = rx + dx * dist;
      const tz = rz + dz * dist;
      if (tx < 0 || tx >= size || tz < 0 || tz >= size) break;
      if (map[tx][tz].roadLevel > 0) {
        foundRoad = true;
        // Fill road tiles from rx,rz to tx,tz
        for (let d = 1; d < dist; d++) {
          const fx = rx + dx * d;
          const fz = rz + dz * d;
          if (canPlaceRoad(fx, fz, map)) {
            map[fx][fz].roadLevel = Math.max(map[fx][fz].roadLevel, level);
          }
        }
        break;
      }
      // Stop if blocked by building/station/etc
      if (!canPlaceRoad(tx, tz, map) && map[tx][tz].roadLevel === 0) break;
    }

    // Step 3: If no existing road found, extend 2 extra tiles to form
    // a short road segment (helps create initial grid structure)
    if (!foundRoad) {
      for (let dist = 1; dist <= 2; dist++) {
        const tx = rx + dx * dist;
        const tz = rz + dz * dist;
        if (canPlaceRoad(tx, tz, map)) {
          map[tx][tz].roadLevel = Math.max(map[tx][tz].roadLevel, level);
        } else {
          break;
        }
      }
    }
  }
}

/**
 * Generate roads around stations with higher level.
 * Creates a cross-shaped road pattern extending from the station.
 */
export function generateStationRoads(stationX: number, stationZ: number, map: GameState['map']): void {
  const size = map.length;

  // Fill 5x5 area around station
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

  // Extend main roads in 4 cardinal directions from station (up to 12 tiles)
  const EXTEND = 12;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
    for (let dist = 3; dist <= EXTEND; dist++) {
      const nx = stationX + dx * dist;
      const nz = stationZ + dz * dist;
      if (canPlaceRoad(nx, nz, map)) {
        map[nx][nz].roadLevel = Math.max(map[nx][nz].roadLevel, 2);
      } else {
        break;
      }
    }
  }
}
