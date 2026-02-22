import type { ToolType, Direction, SubsidiaryType, StationType, TrainVehicleType, GameSpeed } from './types.ts';

// === Map ===
export const GRID_SIZE = 128;
export const TILE_SIZE = 1;
export const MAP_SIZES = { small: 128, medium: 192, large: 256 } as const;

// === Initial State ===
export const INITIAL_CASH = 3_000_000_000;
export const INITIAL_YEAR = 2024;

// === Time ===
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_HOUR = 60;

// === Game Speeds ===
export const GAME_SPEEDS: GameSpeed[] = [0, 0.5, 1, 2, 4, 8, 16];

// === Direction Vectors ===
export const DIRECTION_VECTORS: Record<Direction, { dx: number; dz: number }> = {
  N:  { dx:  0, dz: -1 },
  NE: { dx:  1, dz: -1 },
  E:  { dx:  1, dz:  0 },
  SE: { dx:  1, dz:  1 },
  S:  { dx:  0, dz:  1 },
  SW: { dx: -1, dz:  1 },
  W:  { dx: -1, dz:  0 },
  NW: { dx: -1, dz: -1 },
};

export const DIAGONAL_DIRECTIONS: Direction[] = ['NE', 'SE', 'SW', 'NW'];

export function getDirectionFromDelta(dx: number, dz: number): Direction {
  if (dx === 0 && dz < 0) return 'N';
  if (dx > 0 && dz < 0) return 'NE';
  if (dx > 0 && dz === 0) return 'E';
  if (dx > 0 && dz > 0) return 'SE';
  if (dx === 0 && dz > 0) return 'S';
  if (dx < 0 && dz > 0) return 'SW';
  if (dx < 0 && dz === 0) return 'W';
  return 'NW';
}

export function isDiagonal(dir: Direction): boolean {
  return DIAGONAL_DIRECTIONS.includes(dir);
}

// === Track Costs ===
export const TRACK_COSTS = {
  straight: 5_000_000,
  diagonal: 7_500_000,
  curve: 8_000_000,
  switch: 15_000_000,
  elevated: 12_000_000,
  underground: 15_000_000,
  remove: 1_000_000,
} as const;

// === Station Costs ===
export const STATION_COSTS: Record<StationType, number> = {
  ground_small: 30_000_000,
  ground_large: 80_000_000,
  elevated: 120_000_000,
  terminal: 200_000_000,
  underground: 150_000_000,
  depot: 100_000_000,
};

// === Train Types ===
export const TRAIN_TYPES: Record<TrainVehicleType, {
  name: string; maxSpeed: number; capacity: number; cars: number;
  cost: number; maintenance: number; color: string; farePremium: number;
}> = {
  local: { name: '普通列車', maxSpeed: 80, capacity: 600, cars: 4, cost: 200_000_000, maintenance: 2_000_000, color: '#4ade80', farePremium: 1.0 },
  suburban: { name: '近郊型電車', maxSpeed: 100, capacity: 800, cars: 6, cost: 350_000_000, maintenance: 3_500_000, color: '#60a0e0', farePremium: 1.2 },
  express: { name: '急行列車', maxSpeed: 120, capacity: 400, cars: 6, cost: 500_000_000, maintenance: 5_000_000, color: '#f97316', farePremium: 1.5 },
  diesel: { name: '気動車', maxSpeed: 90, capacity: 400, cars: 3, cost: 180_000_000, maintenance: 2_500_000, color: '#c0a020', farePremium: 1.0 },
  freight: { name: '貨物列車', maxSpeed: 60, capacity: 0, cars: 8, cost: 150_000_000, maintenance: 3_000_000, color: '#94a3b8', farePremium: 0 },
  shinkansen: { name: '新幹線', maxSpeed: 300, capacity: 1200, cars: 16, cost: 5_000_000_000, maintenance: 20_000_000, color: '#ffffff', farePremium: 3.0 },
  steam: { name: '蒸気機関車', maxSpeed: 60, capacity: 200, cars: 5, cost: 300_000_000, maintenance: 4_000_000, color: '#2a2a2a', farePremium: 2.5 },
};

// === Subsidiary Costs ===
export const SUBSIDIARY_COSTS: Record<SubsidiaryType, { build: number; monthly: number; revenue: number }> = {
  factory: { build: 500_000_000, monthly: 10_000_000, revenue: 15_000_000 },
  depot: { build: 300_000_000, monthly: 5_000_000, revenue: 0 },
  hotel: { build: 800_000_000, monthly: 8_000_000, revenue: 20_000_000 },
  department_store: { build: 1_000_000_000, monthly: 15_000_000, revenue: 30_000_000 },
  power_plant: { build: 2_000_000_000, monthly: 20_000_000, revenue: 25_000_000 },
  material_yard: { build: 200_000_000, monthly: 3_000_000, revenue: 0 },
  warehouse: { build: 150_000_000, monthly: 2_000_000, revenue: 1_000_000 },
  resort_hotel: { build: 1_500_000_000, monthly: 12_000_000, revenue: 35_000_000 },
  convenience_store: { build: 50_000_000, monthly: 2_000_000, revenue: 5_000_000 },
  supermarket: { build: 200_000_000, monthly: 5_000_000, revenue: 12_000_000 },
  office_building: { build: 600_000_000, monthly: 8_000_000, revenue: 18_000_000 },
  apartment: { build: 400_000_000, monthly: 3_000_000, revenue: 10_000_000 },
  amusement_park: { build: 3_000_000_000, monthly: 25_000_000, revenue: 40_000_000 },
  stadium: { build: 2_500_000_000, monthly: 20_000_000, revenue: 30_000_000 },
  broadcast_tower: { build: 1_000_000_000, monthly: 5_000_000, revenue: 8_000_000 },
};

export const SUBSIDIARY_NAMES: Record<SubsidiaryType, string> = {
  factory: '工場', depot: '車両基地', hotel: 'ホテル', department_store: 'デパート',
  power_plant: '発電所', material_yard: '資材置場', warehouse: '倉庫',
  resort_hotel: 'リゾートホテル', convenience_store: 'コンビニ', supermarket: 'スーパー',
  office_building: 'オフィスビル', apartment: 'マンション', amusement_park: '遊園地',
  stadium: 'スタジアム', broadcast_tower: '電波塔',
};

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

// === Rush Hour Multipliers ===
export function getPassengerMultiplier(hour: number): number {
  if (hour >= 7 && hour < 9) return 2.5;
  if (hour >= 12 && hour < 13) return 1.3;
  if (hour >= 17 && hour < 20) return 2.2;
  return 1.0;
}

// === Synergy Matrix ===
export const SYNERGY_MATRIX: Record<string, Partial<Record<string, number>>> = {
  residential: { commercial: 1.5, office: 1.2, culture: 1.3, leisure: 1.1, industrial: -0.8 },
  commercial: { residential: 1.5, office: 1.4, leisure: 1.2, industrial: -0.5 },
  office: { commercial: 1.4, residential: 1.2, culture: 1.1 },
  industrial: { residential: -0.8, commercial: -0.5, leisure: -1.0 },
  leisure: { residential: 1.1, commercial: 1.2, culture: 1.3, industrial: -1.0 },
  culture: { residential: 1.3, office: 1.1, leisure: 1.3 },
  agriculture: { residential: 0.8, industrial: -0.3, commercial: -0.2 },
};

// === Material Constants ===
export const MATERIAL_PRODUCTION_PER_DAY = 10;
export const MATERIAL_THRESHOLD_LEVEL4 = 50;
export const MATERIAL_THRESHOLD_LEVEL5 = 100;
export const MATERIAL_TRANSPORT_RADIUS = 10;

// === Loan Constants ===
export const LOAN_INTEREST_RATE = 0.04;
export const MAX_DEBT_RATIO = 3;
export const LOAN_OPTIONS = [
  { amount: 100_000_000, label: '1億円', months: 60 },
  { amount: 500_000_000, label: '5億円', months: 120 },
  { amount: 1_000_000_000, label: '10億円', months: 120 },
  { amount: 5_000_000_000, label: '50億円', months: 180 },
] as const;

// === Land ===
export const LAND_PRICE_MULTIPLIER = 1_000_000;

// === Tool Definitions ===
export interface ToolDef {
  tool: ToolType;
  label: string;
  icon: string;
  category: 'rail' | 'station' | 'train' | 'subsidiary' | 'other';
  cost?: number;
}

export const TOOL_DEFS: ToolDef[] = [
  { tool: 'none', label: '選択', icon: '👆', category: 'other' },
  { tool: 'track_straight', label: '直線線路', icon: '🛤️', category: 'rail', cost: TRACK_COSTS.straight },
  { tool: 'track_diagonal', label: '斜め線路', icon: '↗️', category: 'rail', cost: TRACK_COSTS.diagonal },
  { tool: 'track_curve', label: '曲線線路', icon: '↩️', category: 'rail', cost: TRACK_COSTS.curve },
  { tool: 'track_switch', label: '分岐器', icon: '🔀', category: 'rail', cost: TRACK_COSTS.switch },
  { tool: 'track_elevated', label: '高架線路', icon: '🌉', category: 'rail', cost: TRACK_COSTS.elevated },
  { tool: 'track_underground', label: '地下線路', icon: '🚇', category: 'rail', cost: TRACK_COSTS.underground },
  { tool: 'track_remove', label: '線路撤去', icon: '✂️', category: 'rail' },
  { tool: 'station_ground_small', label: '地上駅(小)', icon: '🏗️', category: 'station', cost: STATION_COSTS.ground_small },
  { tool: 'station_ground_large', label: '地上駅(大)', icon: '🏛️', category: 'station', cost: STATION_COSTS.ground_large },
  { tool: 'station_elevated', label: '高架駅', icon: '🌉', category: 'station', cost: STATION_COSTS.elevated },
  { tool: 'station_terminal', label: '始発駅', icon: '🚉', category: 'station', cost: STATION_COSTS.terminal },
  { tool: 'station_underground', label: '地下鉄駅', icon: '🚇', category: 'station', cost: STATION_COSTS.underground },
  { tool: 'station_depot', label: '操車場', icon: '🔧', category: 'station', cost: STATION_COSTS.depot },
  { tool: 'train_place', label: '列車配置', icon: '🚃', category: 'train' },
  { tool: 'subsidiary_build', label: '子会社', icon: '🏢', category: 'subsidiary' },
  { tool: 'signal_place', label: '信号設置', icon: '🚦', category: 'rail' },
  { tool: 'bulldoze', label: '撤去', icon: '🔨', category: 'other' },
  { tool: 'land_buy', label: '土地購入', icon: '📜', category: 'other' },
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
