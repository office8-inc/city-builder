import type { BuildingType } from './types.ts';

export const GRID_SIZE = 64;

export const INITIAL_MONEY = 50000;

export const BUILDING_COSTS: Record<BuildingType, number> = {
  road: 10,
  residential: 100,
  commercial: 150,
  industrial: 200,
  park: 50,
  power_plant: 500,
  water_tower: 300,
};

export const MONTHLY_UPKEEP: Record<BuildingType, number> = {
  road: 1,
  residential: 0,
  commercial: 0,
  industrial: 0,
  park: 5,
  power_plant: 50,
  water_tower: 30,
};

export const BUILDING_POPULATION: Record<BuildingType, number> = {
  residential: 10,
  commercial: 0,
  industrial: 0,
  road: 0,
  park: 0,
  power_plant: 0,
  water_tower: 0,
};

export const BUILDING_JOBS: Record<BuildingType, number> = {
  residential: 0,
  commercial: 8,
  industrial: 12,
  road: 0,
  park: 1,
  power_plant: 5,
  water_tower: 2,
};

export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;

export const TAX_RATE_PER_CAPITA = 10;

export const BUILDING_COLORS: Record<BuildingType, string> = {
  residential: '#4ade80',
  commercial: '#60a5fa',
  industrial: '#fb923c',
  road: '#374151',
  park: '#22c55e',
  power_plant: '#ef4444',
  water_tower: '#38bdf8',
};

export const BUILDING_LABELS: Record<BuildingType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  road: 'Road',
  park: 'Park',
  power_plant: 'Power Plant',
  water_tower: 'Water Tower',
};

export const TOOL_ICONS: Record<BuildingType | 'bulldoze' | 'none', string> = {
  none: '👆',
  bulldoze: '🔨',
  road: '🛣️',
  residential: '🏠',
  commercial: '🏢',
  industrial: '🏭',
  park: '🌳',
  power_plant: '⚡',
  water_tower: '💧',
};
