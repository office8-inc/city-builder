import type { GameState, Building, BuildingCategory } from './types.ts';
import { BUILDING_SUBTYPES, GRID_SIZE } from './constants.ts';

// Seeded PRNG for consistent building appearance per tile
function seededRandom(seed: number): number {
  let s = seed | 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

let nextBuildingId = 1;

// Category weights by distance zone
const NEAR_WEIGHTS: [BuildingCategory, number][] = [
  ['commercial', 40], ['office', 30], ['residential', 20], ['culture', 10],
];
const MID_WEIGHTS: [BuildingCategory, number][] = [
  ['residential', 50], ['commercial', 25], ['office', 15], ['leisure', 10],
];
const FAR_WEIGHTS: [BuildingCategory, number][] = [
  ['residential', 60], ['agriculture', 20], ['industrial', 15], ['culture', 5],
];

function pickWeighted(weights: [BuildingCategory, number][], rand: number): BuildingCategory {
  const total = weights.reduce((s, w) => s + w[1], 0);
  let r = rand * total;
  for (const [cat, w] of weights) {
    r -= w;
    if (r <= 0) return cat;
  }
  return weights[0][0];
}

function pickSubtype(category: BuildingCategory, rand: number) {
  const subtypes = BUILDING_SUBTYPES[category];
  // For new buildings, pick level-1 compatible subtypes
  const eligible = subtypes.filter(s => s.maxLevel >= 1);
  const idx = Math.floor(rand * eligible.length) % eligible.length;
  return eligible[idx];
}

// Residents per building based on subtype and level
export function getBuildingResidents(subtype: string, level: number): number {
  switch (subtype) {
    case 'house_small': return 4 * level;
    case 'house_medium': return 4 * level;
    case 'apartment_small': return 20 * level;
    case 'apartment_medium': return 80 * level;
    case 'apartment_tower': return 200 * level;
    default: return 0;
  }
}

export function getBuildingWorkers(subtype: string, level: number): number {
  switch (subtype) {
    case 'shop_small': return 5 * level;
    case 'convenience': return 8 * level;
    case 'supermarket': return 30 * level;
    case 'department': return 100 * level;
    case 'mall': return 200 * level;
    case 'office_small': return 20 * level;
    case 'office_medium': return 50 * level;
    case 'office_tower': return 150 * level;
    case 'skyscraper': return 400 * level;
    case 'factory_small': return 30 * level;
    case 'factory_medium': return 60 * level;
    case 'warehouse': return 15 * level;
    case 'plant': return 100 * level;
    case 'school': return 40 * level;
    case 'library': return 10 * level;
    case 'temple': return 5 * level;
    case 'sports': return 20 * level;
    case 'farm_small': return 5 * level;
    case 'farm_large': return 10 * level;
    default: return 0;
  }
}

/**
 * Run city development: spawn new buildings around active stations.
 * Called once per in-game day.
 */
export function developCity(state: GameState): Building[] {
  const { stations, buildings, map } = state;
  const newBuildings: Building[] = [];

  // Cap total buildings
  const MAX_BUILDINGS = 500;
  if (buildings.size >= MAX_BUILDINGS) return newBuildings;

  const remaining = MAX_BUILDINGS - buildings.size;
  // Limit per-tick spawns to prevent lag spikes
  const MAX_SPAWN_PER_TICK = 10;
  let spawned = 0;

  for (const station of stations.values()) {
    if (spawned >= MAX_SPAWN_PER_TICK || spawned >= remaining) break;

    const radius = Math.min(5 + station.activityLevel / 20, 15);

    const minX = Math.max(0, Math.floor(station.x - radius));
    const maxX = Math.min(GRID_SIZE - 1, Math.ceil(station.x + radius));
    const minZ = Math.max(0, Math.floor(station.z - radius));
    const maxZ = Math.min(GRID_SIZE - 1, Math.ceil(station.z + radius));

    for (let x = minX; x <= maxX && spawned < MAX_SPAWN_PER_TICK && spawned < remaining; x++) {
      for (let z = minZ; z <= maxZ && spawned < MAX_SPAWN_PER_TICK && spawned < remaining; z++) {
        const tile = map[x][z];

        // Only build on flat, empty tiles
        if (tile.terrain !== 'flat') continue;
        if (tile.buildingId || tile.stationId || tile.trackIds.length > 0) continue;

        const dist = Math.sqrt((x - station.x) ** 2 + (z - station.z) ** 2);
        if (dist > radius) continue;

        // Probability: closer = higher, activity-dependent
        const baseProbability = Math.min(station.activityLevel / 200, 0.5);
        const distanceFalloff = 1 - dist / radius;
        const probability = baseProbability * distanceFalloff;

        const rand = seededRandom(x * 10007 + z * 7919 + state.gameTime.day * 31 + state.gameTime.month * 367);
        if (rand > probability) continue;

        // Pick category based on distance zone
        const catRand = seededRandom(x * 1000 + z + state.gameTime.year * 13);
        let weights: [BuildingCategory, number][];
        if (dist <= 3) {
          weights = NEAR_WEIGHTS;
        } else if (dist <= 7) {
          weights = MID_WEIGHTS;
        } else {
          weights = FAR_WEIGHTS;
        }
        const category = pickWeighted(weights, catRand);

        // Pick subtype
        const subtypeRand = seededRandom(x * 3001 + z * 4007);
        const spec = pickSubtype(category, subtypeRand);

        // Check if multi-tile building fits
        if (spec.width > 1 || spec.depth > 1) {
          let fits = true;
          for (let dx = 0; dx < spec.width && fits; dx++) {
            for (let dz = 0; dz < spec.depth && fits; dz++) {
              if (dx === 0 && dz === 0) continue;
              const tx = x + dx;
              const tz = z + dz;
              if (tx >= GRID_SIZE || tz >= GRID_SIZE) { fits = false; break; }
              const t = map[tx][tz];
              if (t.terrain !== 'flat' || t.buildingId || t.stationId || t.trackIds.length > 0) {
                fits = false;
              }
            }
          }
          if (!fits) continue;
        }

        const id = `bld_${nextBuildingId++}`;
        const building: Building = {
          id,
          x,
          z,
          type: category,
          subtype: spec.subtype,
          level: 1,
          width: spec.width,
          depth: spec.depth,
          height: spec.height,
          residents: getBuildingResidents(spec.subtype, 1),
          workers: getBuildingWorkers(spec.subtype, 1),
        };

        newBuildings.push(building);

        // Mark tiles occupied
        for (let dx = 0; dx < spec.width; dx++) {
          for (let dz = 0; dz < spec.depth; dz++) {
            map[x + dx][z + dz].buildingId = id;
          }
        }

        spawned++;
      }
    }
  }

  return newBuildings;
}

/**
 * Level up buildings near active stations.
 * Called once per in-game month.
 */
export function levelUpBuildings(state: GameState): void {
  const { stations, buildings } = state;

  for (const building of buildings.values()) {
    // Find nearest station
    let nearestActivity = 0;
    for (const station of stations.values()) {
      const dist = Math.sqrt((building.x - station.x) ** 2 + (building.z - station.z) ** 2);
      const radius = 5 + station.activityLevel / 20;
      if (dist <= radius) {
        nearestActivity = Math.max(nearestActivity, station.activityLevel);
      }
    }

    if (nearestActivity <= 0) continue;

    // Find max level for this subtype
    const category = building.type;
    const subtypes = BUILDING_SUBTYPES[category];
    const spec = subtypes.find(s => s.subtype === building.subtype);
    if (!spec || building.level >= spec.maxLevel) continue;

    // 20% chance per month
    const rand = seededRandom(building.x * 7001 + building.z * 3011 + state.gameTime.month * 97 + state.gameTime.year * 13);
    if (rand > 0.2) continue;

    building.level++;
    building.height = spec.height * building.level;
    building.residents = getBuildingResidents(building.subtype, building.level);
    building.workers = getBuildingWorkers(building.subtype, building.level);
  }
}

/**
 * Calculate total population from all residential buildings.
 */
export function calculatePopulation(buildings: Map<string, Building>): number {
  let pop = 0;
  for (const b of buildings.values()) {
    pop += b.residents;
  }
  return pop;
}
