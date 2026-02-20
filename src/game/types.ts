export type TerrainType = 'grass' | 'water' | 'sand' | 'hill';

export type BuildingType =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'road'
  | 'park'
  | 'power_plant'
  | 'water_tower';

export type ToolType = BuildingType | 'bulldoze' | 'none';

export type GameSpeed = 0 | 1 | 2 | 4;

export interface Building {
  type: BuildingType;
  level: number;
  age: number; // days since placed
}

export interface Tile {
  terrain: TerrainType;
  building: Building | null;
}

export interface GameDate {
  year: number;
  month: number;
  day: number;
}

export interface DemandLevels {
  residential: number; // -100 to 100
  commercial: number;
  industrial: number;
}

export interface GameNotification {
  id: number;
  message: string;
  timestamp: number;
}

export interface GameState {
  grid: Tile[][];
  money: number;
  population: number;
  jobs: number;
  happiness: number;
  date: GameDate;
  speed: GameSpeed;
  demand: DemandLevels;
  selectedTool: ToolType;
  notifications: GameNotification[];
  hoveredTile: { x: number; z: number } | null;

  // Derived stats
  totalResidential: number;
  totalCommercial: number;
  totalIndustrial: number;
  monthlyIncome: number;
  monthlyExpenses: number;

  // Actions
  placeBuilding: (x: number, z: number) => void;
  bulldoze: (x: number, z: number) => void;
  setSpeed: (speed: GameSpeed) => void;
  setSelectedTool: (tool: ToolType) => void;
  setHoveredTile: (tile: { x: number; z: number } | null) => void;
  tick: () => void;
  addNotification: (message: string) => void;
  dismissNotification: (id: number) => void;
}
