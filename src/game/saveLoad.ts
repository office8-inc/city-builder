import type {
  GameState,
  TrackSegment,
  Station,
  Train,
  Building,
  Subsidiary,
  Signal,
  Loan,
  MapTile,
  Finance,
  IncomeBreakdown,
  GameTime,
  GameSpeed,
  QuarterlyRecord,
  Season,
  WeatherType,
  TrainVehicleType,
} from './types.ts';
import { getNextEntityId, setNextEntityId } from './actions.ts';
import { getNextBuildingId, setNextBuildingId } from './cityDevelopment.ts';

interface SerializedStateV1 {
  version: 1;
  map: MapTile[][];
  tracks: [string, TrackSegment][];
  stations: [string, Station][];
  trains: [string, Train][];
  buildings: [string, Building][];
  subsidiaries: [string, Subsidiary][];
  finance: Finance;
  population: number;
  quarterlyHistory: QuarterlyRecord[];
  gameTime: GameTime;
  speed: GameSpeed;
  lastDevelopmentDay: number;
  lastLevelUpMonth: number;
  lastAutoSaveDay: number;
}

interface SerializedStateV2 {
  version: 2;
  map: MapTile[][];
  tracks: [string, TrackSegment][];
  stations: [string, Station][];
  trains: [string, Train][];
  buildings: [string, Building][];
  subsidiaries: [string, Subsidiary][];
  signals: [string, Signal][];
  finance: Finance;
  population: number;
  workforce: number;
  quarterlyHistory: QuarterlyRecord[];
  loans: Loan[];
  ownedLand: string[];
  gameTime: GameTime;
  speed: GameSpeed;
  season: Season;
  weatherType: WeatherType;
  selectedTrainType: TrainVehicleType;
  constructionMode: boolean;
  scenarioId: string | null;
  lastDevelopmentDay: number;
  lastLevelUpMonth: number;
  lastAutoSaveDay: number;
  nextEntityId: number;
  nextBuildingId: number;
}

interface SerializedStateV3 {
  version: 3;
  map: MapTile[][];
  tracks: [string, TrackSegment][];
  stations: [string, Station][];
  trains: [string, Train][];
  buildings: [string, Building][];
  subsidiaries: [string, Subsidiary][];
  signals: [string, Signal][];
  finance: Finance;
  population: number;
  workforce: number;
  quarterlyHistory: QuarterlyRecord[];
  loans: Loan[];
  ownedLand: string[];
  gameTime: GameTime;
  speed: GameSpeed;
  season: Season;
  weatherType: WeatherType;
  selectedTrainType: TrainVehicleType;
  constructionMode: boolean;
  scenarioId: string | null;
  scenarioStartYear: number | null;
  scenarioCleared: boolean;
  bailoutUsed: boolean;
  lastDevelopmentDay: number;
  lastLevelUpMonth: number;
  lastAutoSaveDay: number;
  nextEntityId: number;
  nextBuildingId: number;
}

interface SerializedStateV4 {
  version: 4;
  map: MapTile[][];
  tracks: [string, TrackSegment][];
  stations: [string, Station][];
  trains: [string, Train][];
  buildings: [string, Building][];
  subsidiaries: [string, Subsidiary][];
  signals: [string, Signal][];
  finance: Finance;
  population: number;
  workforce: number;
  quarterlyHistory: QuarterlyRecord[];
  loans: Loan[];
  ownedLand: string[];
  gameTime: GameTime;
  speed: GameSpeed;
  season: Season;
  weatherType: WeatherType;
  selectedTrainType: TrainVehicleType;
  constructionMode: boolean;
  scenarioId: string | null;
  scenarioStartYear: number | null;
  scenarioCleared: boolean;
  bailoutUsed: boolean;
  // v1.0（マイルストーン通知）より前のセーブには存在しないため、ロード時にデフォルト値で補完する
  achievedMilestones: string[];
  totalLoansTaken: number;
  lastDevelopmentDay: number;
  lastLevelUpMonth: number;
  lastAutoSaveDay: number;
  nextEntityId: number;
  nextBuildingId: number;
}

type SerializedState = SerializedStateV1 | SerializedStateV2 | SerializedStateV3 | SerializedStateV4;

// v1.0（terminated追加）より前のセーブにはtrain.terminatedが存在しないため、
// ロード時にデフォルト値(false)で補完する
function normalizeTrain(t: Train): Train {
  return { ...t, terminated: (t as unknown as Partial<Train>).terminated ?? false };
}

// v1.0（資材輸送収入 materialTransport 追加）より前のセーブには存在しないため、
// ロード時にデフォルト値(0)で補完する
function normalizeFinance(f: Finance): Finance {
  return {
    ...f,
    quarterlyIncome: {
      ...f.quarterlyIncome,
      materialTransport: (f.quarterlyIncome as unknown as Partial<IncomeBreakdown>).materialTransport ?? 0,
    },
  };
}

function getSaveKey(slot?: number): string {
  if (slot !== undefined && slot > 0) return `atrain-city-save-${slot}`;
  return 'atrain-city-save';
}

export function serializeState(state: GameState): string {
  const data: SerializedStateV4 = {
    version: 4,
    map: state.map,
    tracks: Array.from(state.tracks.entries()),
    stations: Array.from(state.stations.entries()),
    trains: Array.from(state.trains.entries()),
    buildings: Array.from(state.buildings.entries()),
    subsidiaries: Array.from(state.subsidiaries.entries()),
    signals: Array.from(state.signals.entries()),
    finance: state.finance,
    population: state.population,
    workforce: state.workforce,
    quarterlyHistory: state.quarterlyHistory,
    loans: state.loans,
    ownedLand: Array.from(state.ownedLand),
    gameTime: state.gameTime,
    speed: state.speed,
    season: state.season,
    weatherType: state.weatherType,
    selectedTrainType: state.selectedTrainType,
    constructionMode: state.constructionMode,
    scenarioId: state.scenarioId,
    scenarioStartYear: state.scenarioStartYear,
    scenarioCleared: state.scenarioCleared,
    bailoutUsed: state.bailoutUsed,
    achievedMilestones: Array.from(state.achievedMilestones),
    totalLoansTaken: state.totalLoansTaken,
    lastDevelopmentDay: state.lastDevelopmentDay,
    lastLevelUpMonth: state.lastLevelUpMonth,
    lastAutoSaveDay: state.lastAutoSaveDay,
    nextEntityId: getNextEntityId(),
    nextBuildingId: getNextBuildingId(),
  };
  return JSON.stringify(data);
}

function migrateV1toV2(data: SerializedStateV1): Partial<GameState> {
  let maxEntityId = 0;
  let maxBuildingId = 0;
  for (const [, t] of data.tracks) {
    const n = parseInt(t.id.split('_')[1]);
    if (n > maxEntityId) maxEntityId = n;
  }
  for (const [, s] of data.stations) {
    const n = parseInt(s.id.split('_')[1]);
    if (n > maxEntityId) maxEntityId = n;
  }
  for (const [, t] of data.trains) {
    const n = parseInt(t.id.split('_')[1]);
    if (n > maxEntityId) maxEntityId = n;
  }
  for (const [, b] of data.buildings) {
    const n = parseInt(b.id.split('_')[1]);
    if (n > maxBuildingId) maxBuildingId = n;
  }
  for (const [, s] of data.subsidiaries) {
    const n = parseInt(s.id.split('_')[1]);
    if (n > maxEntityId) maxEntityId = n;
  }

  setNextEntityId(maxEntityId + 1);
  setNextBuildingId(maxBuildingId + 1);

  const finance: Finance = normalizeFinance({
    ...data.finance,
    stockPrice: (data.finance as unknown as Partial<Finance>).stockPrice ?? 1000,
    totalAssets: (data.finance as unknown as Partial<Finance>).totalAssets ?? data.finance.cash,
    quarterlyIncome: {
      ...data.finance.quarterlyIncome,
      landRent: (data.finance.quarterlyIncome as unknown as Partial<IncomeBreakdown>).landRent ?? 0,
    },
  });

  const buildings = new Map<string, Building>(data.buildings);

  const trains = new Map<string, Train>();
  for (const [id, t] of data.trains) {
    trains.set(id, normalizeTrain({
      ...t,
      waitTimer: (t as unknown as Partial<Train>).waitTimer ?? 0,
      materialLoad: (t as unknown as Partial<Train>).materialLoad ?? 0,
      schedule: (t as unknown as Partial<Train>).schedule ?? { stops: [], currentStopIndex: 0, loopMode: 'bounce' },
    }));
  }

  const stations = new Map<string, Station>();
  for (const [id, s] of data.stations) {
    stations.set(id, { ...s, type: (s as unknown as Partial<Station>).type ?? 'ground_small' });
  }

  const subsidiaries = new Map<string, Subsidiary>();
  for (const [id, s] of data.subsidiaries) {
    subsidiaries.set(id, { ...s, level: (s as unknown as Partial<Subsidiary>).level ?? 1 });
  }

  const tracks = new Map<string, TrackSegment>();
  for (const [id, t] of data.tracks) {
    tracks.set(id, {
      ...t,
      direction: (t as unknown as Partial<TrackSegment>).direction ?? (t.startZ === t.endZ ? 'E' : 'S'),
      elevation: (t as unknown as Partial<TrackSegment>).elevation ?? 0,
    });
  }

  return {
    map: data.map,
    tracks,
    stations,
    trains,
    buildings,
    subsidiaries,
    finance,
    population: data.population,
    quarterlyHistory: data.quarterlyHistory || [],
    gameTime: data.gameTime,
    speed: data.speed,
    lastDevelopmentDay: data.lastDevelopmentDay,
    lastLevelUpMonth: data.lastLevelUpMonth,
    lastAutoSaveDay: data.lastAutoSaveDay || 0,
    scenarioStartYear: null,
    scenarioCleared: false,
    bailoutUsed: false,
    achievedMilestones: new Set<string>(),
    totalLoansTaken: 0,
  };
}

function loadV2(data: SerializedStateV2): Partial<GameState> {
  setNextEntityId(data.nextEntityId);
  setNextBuildingId(data.nextBuildingId);

  return {
    map: data.map,
    tracks: new Map(data.tracks),
    stations: new Map(data.stations),
    trains: new Map(data.trains.map(([id, t]) => [id, normalizeTrain(t)])),
    buildings: new Map(data.buildings),
    subsidiaries: new Map(data.subsidiaries),
    signals: new Map(data.signals),
    finance: normalizeFinance(data.finance),
    population: data.population,
    workforce: data.workforce,
    quarterlyHistory: data.quarterlyHistory || [],
    loans: data.loans || [],
    ownedLand: new Set(data.ownedLand || []),
    gameTime: data.gameTime,
    speed: data.speed,
    season: data.season,
    weatherType: data.weatherType,
    selectedTrainType: data.selectedTrainType,
    constructionMode: data.constructionMode,
    scenarioId: data.scenarioId,
    // v2セーブにはシナリオ進行・救済融資フラグが存在しないためデフォルト値で補完
    scenarioStartYear: null,
    scenarioCleared: false,
    bailoutUsed: false,
    // v2セーブにはマイルストーン進行が存在しないためデフォルト値で補完
    achievedMilestones: new Set<string>(),
    totalLoansTaken: 0,
    lastDevelopmentDay: data.lastDevelopmentDay,
    lastLevelUpMonth: data.lastLevelUpMonth,
    lastAutoSaveDay: data.lastAutoSaveDay || 0,
  };
}

function loadV3(data: SerializedStateV3): Partial<GameState> {
  setNextEntityId(data.nextEntityId);
  setNextBuildingId(data.nextBuildingId);

  return {
    map: data.map,
    tracks: new Map(data.tracks),
    stations: new Map(data.stations),
    trains: new Map(data.trains.map(([id, t]) => [id, normalizeTrain(t)])),
    buildings: new Map(data.buildings),
    subsidiaries: new Map(data.subsidiaries),
    signals: new Map(data.signals),
    finance: normalizeFinance(data.finance),
    population: data.population,
    workforce: data.workforce,
    quarterlyHistory: data.quarterlyHistory || [],
    loans: data.loans || [],
    ownedLand: new Set(data.ownedLand || []),
    gameTime: data.gameTime,
    speed: data.speed,
    season: data.season,
    weatherType: data.weatherType,
    selectedTrainType: data.selectedTrainType,
    constructionMode: data.constructionMode,
    scenarioId: data.scenarioId,
    scenarioStartYear: data.scenarioStartYear ?? null,
    scenarioCleared: data.scenarioCleared ?? false,
    bailoutUsed: data.bailoutUsed ?? false,
    // v3セーブにはマイルストーン進行が存在しないためデフォルト値で補完
    achievedMilestones: new Set<string>(),
    totalLoansTaken: 0,
    lastDevelopmentDay: data.lastDevelopmentDay,
    lastLevelUpMonth: data.lastLevelUpMonth,
    lastAutoSaveDay: data.lastAutoSaveDay || 0,
  };
}

function loadV4(data: SerializedStateV4): Partial<GameState> {
  setNextEntityId(data.nextEntityId);
  setNextBuildingId(data.nextBuildingId);

  return {
    map: data.map,
    tracks: new Map(data.tracks),
    stations: new Map(data.stations),
    trains: new Map(data.trains.map(([id, t]) => [id, normalizeTrain(t)])),
    buildings: new Map(data.buildings),
    subsidiaries: new Map(data.subsidiaries),
    signals: new Map(data.signals),
    finance: normalizeFinance(data.finance),
    population: data.population,
    workforce: data.workforce,
    quarterlyHistory: data.quarterlyHistory || [],
    loans: data.loans || [],
    ownedLand: new Set(data.ownedLand || []),
    gameTime: data.gameTime,
    speed: data.speed,
    season: data.season,
    weatherType: data.weatherType,
    selectedTrainType: data.selectedTrainType,
    constructionMode: data.constructionMode,
    scenarioId: data.scenarioId,
    scenarioStartYear: data.scenarioStartYear ?? null,
    scenarioCleared: data.scenarioCleared ?? false,
    bailoutUsed: data.bailoutUsed ?? false,
    achievedMilestones: new Set(data.achievedMilestones || []),
    totalLoansTaken: data.totalLoansTaken ?? 0,
    lastDevelopmentDay: data.lastDevelopmentDay,
    lastLevelUpMonth: data.lastLevelUpMonth,
    lastAutoSaveDay: data.lastAutoSaveDay || 0,
  };
}

export function saveToLocalStorage(state: GameState, slot?: number): void {
  try {
    const json = serializeState(state);
    localStorage.setItem(getSaveKey(slot), json);
  } catch {
    console.warn('Failed to save game');
  }
}

export function loadFromLocalStorage(slot?: number): Partial<GameState> | null {
  try {
    const json = localStorage.getItem(getSaveKey(slot));
    if (!json) return null;

    const data: SerializedState = JSON.parse(json);

    if (data.version === 1) {
      return migrateV1toV2(data);
    }
    if (data.version === 2) {
      return loadV2(data);
    }
    if (data.version === 3) {
      return loadV3(data);
    }
    if (data.version === 4) {
      return loadV4(data);
    }

    return null;
  } catch {
    console.warn('Failed to load game');
    return null;
  }
}

export function hasSavedGame(slot?: number): boolean {
  return localStorage.getItem(getSaveKey(slot)) !== null;
}
