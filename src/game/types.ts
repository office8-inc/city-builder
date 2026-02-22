// === Terrain ===
export type TerrainType = 'flat' | 'hill' | 'mountain' | 'water' | 'forest';

// === Direction (8方向) ===
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

// === Track System ===
export interface TrackSegment {
  id: string;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  type: 'straight' | 'curve' | 'switch';
  direction: Direction;
  elevation: number; // 高架レベル (0=地上)
}

// === Station ===
export interface Station {
  id: string;
  name: string;
  x: number;
  z: number;
  platforms: number;
  platformLength: number;
  type: 'ground' | 'elevated' | 'underground' | 'terminal';
  connectedTracks: string[];
  dailyPassengers: number;
  influenceRadius: number;
  activityLevel: number; // 0-100
}

// === Train ===
export interface Train {
  id: string;
  name: string;
  type: 'local' | 'express' | 'freight';
  color: string;
  cars: number;
  maxSpeed: number;
  currentSegmentId: string;
  positionOnSegment: number; // 0.0 ~ 1.0
  speed: number;
  direction: 1 | -1;
  passengers: number;
  capacity: number;
  schedule: TrainSchedule;
  state: 'running' | 'stopped' | 'waiting';
}

export interface TrainSchedule {
  stops: ScheduleStop[];
  currentStopIndex: number;
  loopMode: 'loop' | 'bounce';
}

export interface ScheduleStop {
  stationId: string;
  action: 'stop' | 'pass';
  waitTime: number;
}

// === Building (自動発展で生成) ===
export type BuildingCategory =
  | 'residential'
  | 'commercial'
  | 'office'
  | 'industrial'
  | 'leisure'
  | 'culture'
  | 'agriculture';

export interface Building {
  id: string;
  x: number;
  z: number;
  type: BuildingCategory;
  subtype: string;
  level: number; // 1-5
  width: number;
  depth: number;
  height: number; // floors
  residents: number;
  workers: number;
}

// === Subsidiary (プレイヤーが建設) ===
export type SubsidiaryType =
  | 'factory'
  | 'depot'
  | 'hotel'
  | 'department_store'
  | 'power_plant';

export interface Subsidiary {
  id: string;
  x: number;
  z: number;
  type: SubsidiaryType;
  name: string;
  buildCost: number;
  monthlyRevenue: number;
  monthlyExpense: number;
}

// === Map Tile ===
export interface MapTile {
  terrain: TerrainType;
  height: number; // 0-10
  trackIds: string[];
  buildingId: string | null;
  stationId: string | null;
  subsidiaryId: string | null;
  landValue: number; // 0-100
  materialStock: number;
  roadLevel: number; // 0=なし, 1=小道, 2=道路, 3=大通り
}

// === Game Time ===
export interface GameTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export type GameSpeed = 0 | 1 | 2 | 4 | 8;

// === Finance ===
export interface Finance {
  cash: number;
  debt: number;
  quarterlyIncome: IncomeBreakdown;
  quarterlyExpenses: ExpenseBreakdown;
}

export interface IncomeBreakdown {
  railFare: number;
  subsidiary: number;
  other: number;
}

export interface ExpenseBreakdown {
  trackMaintenance: number;
  trainMaintenance: number;
  staffCost: number;
  subsidiaryRunning: number;
  interestPayment: number;
}

// === Camera Mode ===
export type CameraMode = 'free' | 'follow';

// === Tool Type ===
export type ToolType =
  | 'none'
  | 'track_straight'
  | 'track_curve'
  | 'track_remove'
  | 'station_build'
  | 'train_place'
  | 'subsidiary_build'
  | 'bulldoze';

// === Notification ===
export interface GameNotification {
  id: number;
  message: string;
  timestamp: number;
}

// === Game State ===
export interface GameState {
  // Map
  map: MapTile[][];
  mapSize: number;

  // Entities
  tracks: Map<string, TrackSegment>;
  stations: Map<string, Station>;
  trains: Map<string, Train>;
  buildings: Map<string, Building>;
  subsidiaries: Map<string, Subsidiary>;

  // Economy
  finance: Finance;
  population: number;

  // Time
  gameTime: GameTime;
  speed: GameSpeed;

  // Development tracking
  lastDevelopmentDay: number;
  lastLevelUpMonth: number;

  // UI state
  selectedTool: ToolType;
  hoveredTile: { x: number; z: number } | null;
  notifications: GameNotification[];

  // Camera
  cameraMode: CameraMode;
  followTrainId: string | null;

  // Actions
  setSpeed: (speed: GameSpeed) => void;
  setSelectedTool: (tool: ToolType) => void;
  setHoveredTile: (tile: { x: number; z: number } | null) => void;
  tick: () => void;
  addNotification: (message: string) => void;
  dismissNotification: (id: number) => void;
  placeTrack: (startX: number, startZ: number, endX: number, endZ: number) => void;
  buildStation: (x: number, z: number) => void;
  placeTrain: (stationId: string) => void;
  setCameraMode: (mode: CameraMode) => void;
  setFollowTrainId: (id: string | null) => void;
}
