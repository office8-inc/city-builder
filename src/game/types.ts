// === Terrain ===
export type TerrainType = 'flat' | 'hill' | 'mountain' | 'water' | 'forest';

// === Direction (8方向) ===
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

// === Season ===
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

// === Weather ===
export type WeatherType = 'clear' | 'cloudy' | 'rain';

// === Track System ===
export interface TrackSegment {
  id: string;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  type: 'straight';
  direction: Direction;
  elevation: number;
}

// === Station ===
export type StationType = 'ground_small' | 'ground_large' | 'elevated' | 'terminal' | 'underground' | 'depot';

export interface Station {
  id: string;
  name: string;
  x: number;
  z: number;
  platforms: number;
  platformLength: number;
  type: StationType;
  connectedTracks: string[];
  dailyPassengers: number;
  influenceRadius: number;
  activityLevel: number;
  // 駅が属する線路の高度(elevation)。地上=0/高架=1/地下=-1。connectedTracks・列車配置・
  // 到着判定を、地上/高架/地下が混在するタイルでも正しいレイヤーに絞り込むために使う
  elevation: number;
}

// === Train ===
export type TrainVehicleType = 'local' | 'express' | 'freight' | 'suburban' | 'diesel' | 'shinkansen' | 'steam';

export interface Train {
  id: string;
  name: string;
  type: TrainVehicleType;
  color: string;
  cars: number;
  maxSpeed: number;
  currentSegmentId: string;
  positionOnSegment: number;
  speed: number;
  direction: 1 | -1;
  passengers: number;
  capacity: number;
  schedule: TrainSchedule;
  state: 'running' | 'stopped' | 'waiting';
  waitTimer: number;
  materialLoad: number;
  // 貨物列車が現在の積荷を積み込んだ駅のID（積載0のときはnull）。同一駅での
  // 積み下ろしによる不正な輸送収入（同じ場所で積んで即降ろす）を防ぐために使う
  loadedAtStationId: string | null;
  // 片道(one-way)運行で終端駅に到達し運行終了した状態。state==='stopped'と併用し、
  // 「信号待ち等の一時停止」と区別する。手動再出発（restartTerminatedTrain）まで停止したまま
  terminated: boolean;
}

export interface TrainSchedule {
  stops: ScheduleStop[];
  currentStopIndex: number;
  loopMode: 'loop' | 'bounce' | 'one-way';
}

export interface ScheduleStop {
  stationId: string;
  action: 'stop' | 'pass';
  waitTime: number;
  departureTime?: { hour: number; minute: number };
}

// === Building ===
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
  level: number;
  width: number;
  depth: number;
  height: number;
  residents: number;
  workers: number;
}

// === Subsidiary ===
export type SubsidiaryType =
  | 'factory'
  | 'depot'
  | 'hotel'
  | 'department_store'
  | 'power_plant'
  | 'material_yard'
  | 'warehouse'
  | 'resort_hotel'
  | 'convenience_store'
  | 'supermarket'
  | 'office_building'
  | 'apartment'
  | 'amusement_park'
  | 'stadium'
  | 'broadcast_tower';

export interface Subsidiary {
  id: string;
  x: number;
  z: number;
  type: SubsidiaryType;
  name: string;
  buildCost: number;
  monthlyRevenue: number;
  monthlyExpense: number;
  level: number;
}

// === Map Tile ===
export interface MapTile {
  terrain: TerrainType;
  height: number;
  trackIds: string[];
  buildingId: string | null;
  stationId: string | null;
  subsidiaryId: string | null;
  landValue: number;
  materialStock: number;
  roadLevel: number;
}

// === Game Time ===
export interface GameTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export type GameSpeed = 0 | 0.5 | 1 | 2 | 4 | 8 | 16;

// === Finance ===
export interface Finance {
  cash: number;
  debt: number;
  quarterlyIncome: IncomeBreakdown;
  quarterlyExpenses: ExpenseBreakdown;
  stockPrice: number;
  totalAssets: number;
}

export interface IncomeBreakdown {
  railFare: number;
  subsidiary: number;
  other: number;
  landRent: number;
  // v1.0新規: 貨物列車の資材輸送収入（荷降ろし時に計上）
  materialTransport: number;
}

export interface ExpenseBreakdown {
  trackMaintenance: number;
  trainMaintenance: number;
  staffCost: number;
  subsidiaryRunning: number;
  interestPayment: number;
}

// === Loan ===
export interface Loan {
  id: string;
  principal: number;
  interestRate: number;
  monthlyPayment: number;
  remainingMonths: number;
  takenAtYear: number;
  takenAtMonth: number;
}

// === Quarterly Record ===
export interface QuarterlyRecord {
  year: number;
  quarter: number;
  income: number;
  expenses: number;
}

// === Signal ===
export interface Signal {
  id: string;
  x: number;
  z: number;
  segmentId: string;
  state: 'green' | 'yellow' | 'red';
}

// === Scenario ===
export interface ScenarioObjective {
  id: string;
  description: string;
  type: 'population' | 'income' | 'stations' | 'tracks' | 'trains' | 'cash';
  target: number;
  completed: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  mapSeed: number;
  initialCash: number;
  objectives: ScenarioObjective[];
  timeLimit?: number;
}

// === Game Phase ===
export type GamePhase = 'title' | 'playing' | 'tutorial' | 'gameover' | 'map_editor' | 'scenario_clear' | 'scenario_failed';

// === Camera Mode ===
export type CameraMode = 'free' | 'follow' | 'quarter';
export type FollowMode = 'chase' | 'cab';

// === Tool Type ===
export type ToolType =
  | 'none'
  | 'track_straight'
  | 'track_diagonal'
  | 'track_elevated'
  | 'track_underground'
  | 'track_remove'
  | 'station_ground_small'
  | 'station_ground_large'
  | 'station_elevated'
  | 'station_terminal'
  | 'station_underground'
  | 'station_depot'
  | 'station_build'
  | 'train_place'
  | 'subsidiary_build'
  | 'bulldoze'
  | 'signal_place'
  | 'land_buy'
  | 'land_sell';

// === Notification ===
export interface GameNotification {
  id: number;
  message: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'error' | 'success';
}

// === Confirm Dialog ===
// 破壊的な操作（駅・列車・子会社の撤去、ロードによる進行状況の上書き等）の前に
// ユーザーに確認を求めるための汎用モーダル状態
export interface ConfirmDialogState {
  message: string;
  onConfirm: () => void;
}

// === Game State ===
export interface GameState {
  map: MapTile[][];
  mapSize: number;
  // mapはタイルを直接ミューテートすることが多く配列参照が変わらないため、
  // 道路生成（generateRoads/generateStationRoads）が起きたことをReact側に伝える
  // 軽量な変更シグナル。map全体の参照を毎回置き換えるとTerrainのジオメトリ再生成
  // コストが大きいため、Roads.tsx専用の依存として使う
  roadRevision: number;

  tracks: Map<string, TrackSegment>;
  stations: Map<string, Station>;
  trains: Map<string, Train>;
  buildings: Map<string, Building>;
  subsidiaries: Map<string, Subsidiary>;
  signals: Map<string, Signal>;

  finance: Finance;
  population: number;
  workforce: number;
  quarterlyHistory: QuarterlyRecord[];
  loans: Loan[];
  ownedLand: Set<string>;

  gameTime: GameTime;
  speed: GameSpeed;
  season: Season;
  weatherType: WeatherType;

  lastDevelopmentDay: number;
  lastLevelUpMonth: number;
  lastAutoSaveDay: number;

  gamePhase: GamePhase;
  tutorialStep: number;
  showHelpPanel: boolean;
  constructionMode: boolean;
  scenarioId: string | null;
  // シナリオ開始時の年（残り年数・制限時間判定に使用）
  scenarioStartYear: number | null;
  // シナリオ目標を一度でも達成済みか（続行プレイ中の再発火防止）
  scenarioCleared: boolean;
  // 経営破綻からの緊急支援融資を使用済みか（1ゲームにつき1回限り）
  bailoutUsed: boolean;
  // 達成済みマイルストーンのID集合（一度通知したものを再通知しないため。GAME_DESIGN.md未記載の軽量実績システム）
  achievedMilestones: Set<string>;
  // これまでに借入（通常融資＋緊急支援融資）を行った回数の累計。「融資完済」マイルストーン判定に使用
  totalLoansTaken: number;

  selectedTool: ToolType;
  selectedSubsidiaryType: SubsidiaryType | null;
  selectedTrainType: TrainVehicleType;
  hoveredTile: { x: number; z: number } | null;
  notifications: GameNotification[];
  showFinancePanel: boolean;
  showSchedulePanel: boolean;
  showSettingsPanel: boolean;
  selectedTrainId: string | null;
  confirmDialog: ConfirmDialogState | null;

  cameraMode: CameraMode;
  followMode: FollowMode;
  followTrainId: string | null;

  setSpeed: (speed: GameSpeed) => void;
  setSelectedTool: (tool: ToolType) => void;
  setSelectedSubsidiaryType: (type: SubsidiaryType | null) => void;
  setSelectedTrainType: (type: TrainVehicleType) => void;
  setHoveredTile: (tile: { x: number; z: number } | null) => void;
  tick: () => void;
  addNotification: (message: string, severity?: GameNotification['severity']) => void;
  dismissNotification: (id: number) => void;
  placeTrack: (startX: number, startZ: number, endX: number, endZ: number) => void;
  buildStation: (x: number, z: number, stationType?: StationType) => void;
  placeTrain: (stationId: string) => void;
  buildSubsidiary: (x: number, z: number) => void;
  removeTrack: (x: number, z: number) => void;
  bulldoze: (x: number, z: number) => void;
  // 列車をIDで直接撤去する。列車は移動体のため、確認ダイアログ表示中に座標がズレる
  // bulldoze(x, z)の再実行では対象を取り違える恐れがあり、その回避に使う
  removeTrainById: (trainId: string) => void;
  setCameraMode: (mode: CameraMode) => void;
  setFollowMode: (mode: FollowMode) => void;
  setFollowTrainId: (id: string | null) => void;
  toggleFinancePanel: () => void;
  toggleHelpPanel: () => void;
  toggleSchedulePanel: () => void;
  toggleSettingsPanel: () => void;
  requestConfirm: (message: string, onConfirm: () => void) => void;
  closeConfirm: () => void;
  setGamePhase: (phase: GamePhase) => void;
  nextTutorialStep: () => void;
  skipTutorial: () => void;
  saveGame: (slot?: number) => void;
  loadGame: (slot?: number) => void;
  takeLoan: (amount: number, months: number) => void;
  repayLoan: (loanId: string) => void;
  takeBailout: () => void;
  buyLand: (x: number, z: number) => void;
  sellLand: (x: number, z: number) => void;
  placeSignal: (x: number, z: number) => void;
  setSelectedTrainId: (id: string | null) => void;
  updateTrainSchedule: (trainId: string, schedule: TrainSchedule) => void;
  // 片道運行で終着(terminated)した列車を、進行方向を反転させて再出発させる
  restartTerminatedTrain: (trainId: string) => void;
  setConstructionMode: (mode: boolean) => void;
  setScenarioId: (id: string | null) => void;
  setWeatherType: (type: WeatherType) => void;
  setTileType: (x: number, z: number, terrain: TerrainType, height?: number) => void;
  resetForNewGame: (seed?: number) => void;
}
