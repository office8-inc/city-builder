import type { ToolType } from './types.ts';

// === Map ===
export const GRID_SIZE = 128;
export const TILE_SIZE = 1; // world units per tile

// === Initial State ===
export const INITIAL_CASH = 3_000_000_000; // 30億円
export const INITIAL_YEAR = 2024;

// === Time ===
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_HOUR = 60;

// === Track Costs ===
export const TRACK_COSTS = {
  straight: 5_000_000,
  curve: 8_000_000,
  switch: 15_000_000,
  remove: 1_000_000,
} as const;

// === Station Costs ===
export const STATION_COSTS = {
  ground: 50_000_000,
  elevated: 80_000_000,
  underground: 120_000_000,
  terminal: 200_000_000,
} as const;

// === Train Types ===
export const TRAIN_TYPES = {
  local: {
    name: '普通列車',
    maxSpeed: 80,
    capacity: 600,
    cars: 4,
    cost: 200_000_000,
    maintenance: 2_000_000,
    color: '#4ade80',
  },
  express: {
    name: '急行列車',
    maxSpeed: 120,
    capacity: 400,
    cars: 6,
    cost: 500_000_000,
    maintenance: 5_000_000,
    color: '#f97316',
  },
  freight: {
    name: '貨物列車',
    maxSpeed: 60,
    capacity: 0,
    cars: 8,
    cost: 150_000_000,
    maintenance: 3_000_000,
    color: '#94a3b8',
  },
} as const;

// === Subsidiary Costs ===
export const SUBSIDIARY_COSTS = {
  factory: { build: 500_000_000, monthly: 10_000_000, revenue: 15_000_000 },
  depot: { build: 300_000_000, monthly: 5_000_000, revenue: 0 },
  hotel: { build: 800_000_000, monthly: 8_000_000, revenue: 20_000_000 },
  department_store: { build: 1_000_000_000, monthly: 15_000_000, revenue: 30_000_000 },
  power_plant: { build: 2_000_000_000, monthly: 20_000_000, revenue: 25_000_000 },
} as const;

// === Building Subtypes ===
export const BUILDING_SUBTYPES = {
  residential: [
    { subtype: 'house_small', name: '一戸建て', width: 1, depth: 1, height: 1, maxLevel: 1 },
    { subtype: 'house_medium', name: '二階建て住宅', width: 1, depth: 1, height: 2, maxLevel: 2 },
    { subtype: 'apartment_small', name: 'アパート', width: 1, depth: 1, height: 3, maxLevel: 3 },
    { subtype: 'apartment_medium', name: 'マンション', width: 2, depth: 2, height: 5, maxLevel: 4 },
    { subtype: 'apartment_tower', name: 'タワーマンション', width: 2, depth: 2, height: 15, maxLevel: 5 },
  ],
  commercial: [
    { subtype: 'shop_small', name: '小さな店舗', width: 1, depth: 1, height: 1, maxLevel: 1 },
    { subtype: 'convenience', name: 'コンビニ', width: 1, depth: 1, height: 1, maxLevel: 2 },
    { subtype: 'supermarket', name: 'スーパー', width: 2, depth: 2, height: 2, maxLevel: 3 },
    { subtype: 'department', name: 'デパート', width: 3, depth: 3, height: 6, maxLevel: 4 },
    { subtype: 'mall', name: 'ショッピングモール', width: 4, depth: 4, height: 4, maxLevel: 5 },
  ],
  office: [
    { subtype: 'office_small', name: '小オフィスビル', width: 1, depth: 1, height: 3, maxLevel: 1 },
    { subtype: 'office_medium', name: '中層ビル', width: 1, depth: 1, height: 8, maxLevel: 3 },
    { subtype: 'office_tower', name: '高層オフィス', width: 2, depth: 2, height: 20, maxLevel: 4 },
    { subtype: 'skyscraper', name: '超高層ビル', width: 2, depth: 2, height: 40, maxLevel: 5 },
  ],
  industrial: [
    { subtype: 'factory_small', name: '小工場', width: 2, depth: 2, height: 2, maxLevel: 1 },
    { subtype: 'factory_medium', name: '中規模工場', width: 3, depth: 3, height: 3, maxLevel: 2 },
    { subtype: 'warehouse', name: '倉庫', width: 2, depth: 3, height: 2, maxLevel: 2 },
    { subtype: 'plant', name: '大規模プラント', width: 4, depth: 4, height: 4, maxLevel: 3 },
  ],
  leisure: [
    { subtype: 'park_small', name: '公園', width: 2, depth: 2, height: 0, maxLevel: 2 },
    { subtype: 'sports', name: 'スポーツ施設', width: 3, depth: 3, height: 2, maxLevel: 3 },
  ],
  culture: [
    { subtype: 'school', name: '学校', width: 3, depth: 2, height: 3, maxLevel: 2 },
    { subtype: 'library', name: '図書館', width: 2, depth: 2, height: 2, maxLevel: 2 },
    { subtype: 'temple', name: '寺院', width: 2, depth: 2, height: 2, maxLevel: 1 },
  ],
  agriculture: [
    { subtype: 'farm_small', name: '田畑', width: 3, depth: 3, height: 0, maxLevel: 1 },
    { subtype: 'farm_large', name: '大規模農地', width: 5, depth: 5, height: 0, maxLevel: 2 },
  ],
} as const;

// === Tool Definitions ===
export interface ToolDef {
  tool: ToolType;
  label: string;
  icon: string;
  category: 'rail' | 'station' | 'train' | 'subsidiary' | 'other';
}

export const TOOL_DEFS: ToolDef[] = [
  { tool: 'none', label: '選択', icon: '👆', category: 'other' },
  { tool: 'track_straight', label: '直線線路', icon: '🛤️', category: 'rail' },
  { tool: 'track_curve', label: '曲線線路', icon: '↩️', category: 'rail' },
  { tool: 'track_remove', label: '線路撤去', icon: '✂️', category: 'rail' },
  { tool: 'station_build', label: '駅建設', icon: '🏗️', category: 'station' },
  { tool: 'train_place', label: '列車配置', icon: '🚃', category: 'train' },
  { tool: 'subsidiary_build', label: '子会社', icon: '🏢', category: 'subsidiary' },
  { tool: 'bulldoze', label: '撤去', icon: '🔨', category: 'other' },
];

// === Terrain Colors (for minimap) ===
export const TERRAIN_COLORS: Record<string, string> = {
  flat: '#5a9e3e',
  hill: '#7a9a5e',
  mountain: '#8a8a7a',
  water: '#3a7bd5',
  forest: '#2d7a2d',
};

// === Format money (Japanese style) ===
export function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 100_000_000) {
    const oku = Math.floor(abs / 100_000_000);
    const man = Math.floor((abs % 100_000_000) / 10_000);
    return man > 0 ? `${sign}${oku}億${man}万円` : `${sign}${oku}億円`;
  }
  if (abs >= 10_000) {
    return `${sign}${Math.floor(abs / 10_000)}万円`;
  }
  return `${sign}${abs}円`;
}
