import type { Tile, DemandLevels, Building, BuildingType } from './types.ts';
import {
  GRID_SIZE,
  BUILDING_POPULATION,
  BUILDING_JOBS,
  MONTHLY_UPKEEP,
  TAX_RATE_PER_CAPITA,
} from './constants.ts';

export function countBuildings(grid: Tile[][]): Record<BuildingType, number> {
  const counts: Record<string, number> = {
    residential: 0,
    commercial: 0,
    industrial: 0,
    road: 0,
    park: 0,
    power_plant: 0,
    water_tower: 0,
  };
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const building = grid[x][z].building;
      if (building) {
        counts[building.type]++;
      }
    }
  }
  return counts as Record<BuildingType, number>;
}

export function calculateMaxPopulation(grid: Tile[][]): number {
  let maxPop = 0;
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const building = grid[x][z].building;
      if (building && building.type === 'residential') {
        maxPop += BUILDING_POPULATION.residential * building.level;
      }
    }
  }
  return maxPop;
}

export function calculateTotalJobs(grid: Tile[][]): number {
  let totalJobs = 0;
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const building = grid[x][z].building;
      if (building) {
        totalJobs += BUILDING_JOBS[building.type] * building.level;
      }
    }
  }
  return totalJobs;
}

export function calculateHappiness(
  population: number,
  jobs: number,
  parkCount: number,
  hasPower: boolean,
  hasWater: boolean,
): number {
  if (population === 0) return 50;

  let happiness = 50;

  // Job satisfaction: more jobs relative to population = happier
  const jobRatio = population > 0 ? Math.min(jobs / population, 1) : 0;
  happiness += jobRatio * 20;

  // Parks boost happiness
  happiness += Math.min(parkCount * 2, 20);

  // Utilities
  if (hasPower) happiness += 5;
  if (hasWater) happiness += 5;

  return Math.round(Math.max(0, Math.min(100, happiness)));
}

export function calculateDemand(
  population: number,
  counts: Record<BuildingType, number>,
): DemandLevels {
  const maxPop = counts.residential * BUILDING_POPULATION.residential;
  const totalJobs =
    counts.commercial * BUILDING_JOBS.commercial +
    counts.industrial * BUILDING_JOBS.industrial;

  // Residential demand: high when jobs available but not enough housing
  let resDemand = 0;
  if (totalJobs > population * 0.8) {
    resDemand = Math.min(100, (totalJobs - population * 0.8) * 2);
  } else if (maxPop > 0) {
    resDemand = Math.max(-50, (population / maxPop - 0.5) * -100);
  }
  // Base positive demand if city is small
  if (counts.residential < 5) resDemand = Math.max(resDemand, 50);

  // Commercial demand: grows with population
  let comDemand = 0;
  if (population > 0) {
    const comRatio = counts.commercial > 0 ? population / (counts.commercial * 20) : 10;
    comDemand = Math.min(100, Math.max(-50, (comRatio - 1) * 50));
  }
  if (population > 10 && counts.commercial < 2) comDemand = Math.max(comDemand, 60);

  // Industrial demand: needed for jobs
  let indDemand = 0;
  if (population > 0) {
    const indRatio = counts.industrial > 0 ? population / (counts.industrial * 15) : 10;
    indDemand = Math.min(100, Math.max(-50, (indRatio - 1) * 40));
  }
  if (population > 20 && counts.industrial < 2) indDemand = Math.max(indDemand, 50);

  return {
    residential: Math.round(resDemand),
    commercial: Math.round(comDemand),
    industrial: Math.round(indDemand),
  };
}

export function calculateMonthlyIncome(population: number, happiness: number): number {
  return Math.round(population * TAX_RATE_PER_CAPITA * (happiness / 100));
}

export function calculateMonthlyExpenses(grid: Tile[][]): number {
  let expenses = 0;
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const building = grid[x][z].building;
      if (building) {
        expenses += MONTHLY_UPKEEP[building.type];
      }
    }
  }
  return expenses;
}

export function simulatePopulationGrowth(
  currentPopulation: number,
  maxPopulation: number,
  jobs: number,
  happiness: number,
): number {
  if (maxPopulation === 0) return 0;

  const housingAvailable = maxPopulation - currentPopulation;
  if (housingAvailable <= 0) return currentPopulation;

  const jobAttraction = jobs > 0 ? Math.min(jobs / Math.max(currentPopulation, 1), 1.5) : 0.1;
  const happinessFactor = happiness / 100;

  // Growth rate: small fraction of available housing, modified by jobs and happiness
  const growthRate = 0.02 * jobAttraction * happinessFactor;
  const growth = Math.max(1, Math.floor(housingAvailable * growthRate));

  return Math.min(maxPopulation, currentPopulation + growth);
}

export function ageBuildingsAndGrow(grid: Tile[][]): void {
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const building = grid[x][z].building;
      if (building) {
        building.age++;
        // Buildings grow levels over time
        if (building.type === 'residential' && building.age > 90 && building.level < 3) {
          building.level = Math.min(3, building.level + 1);
          building.age = 0;
        } else if (building.type === 'commercial' && building.age > 120 && building.level < 5) {
          building.level = Math.min(5, building.level + 1);
          building.age = 0;
        } else if (building.type === 'industrial' && building.age > 150 && building.level < 2) {
          building.level = Math.min(2, building.level + 1);
          building.age = 0;
        }
      }
    }
  }
}

export function hasAdjacentRoad(grid: Tile[][], x: number, z: number): boolean {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dx, dz] of dirs) {
    const nx = x + dx;
    const nz = z + dz;
    if (nx >= 0 && nx < GRID_SIZE && nz >= 0 && nz < GRID_SIZE) {
      const b = grid[nx][nz].building;
      if (b && b.type === 'road') return true;
    }
  }
  return false;
}

export function createBuilding(type: BuildingType): Building {
  return { type, level: 1, age: 0 };
}
