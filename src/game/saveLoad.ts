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
// ロード時にデフォルト値(false)で補完する。loadedAtStationId（同一駅での貨物輸送収入
// 不正取得防止）も同様に、それ以前のセーブには存在しないためnullで補完する
function normalizeTrain(t: Train): Train {
  return {
    ...t,
    terminated: (t as unknown as Partial<Train>).terminated ?? false,
    loadedAtStationId: (t as unknown as Partial<Train>).loadedAtStationId ?? null,
  };
}

// 駅の地上/高架/地下レイヤー整合性修正より前のセーブにはstation.elevationが存在しない
// ため、駅種別(type)から決定論的に復元してロード時に補完する。
// また、その修正より前のセーブは connectedTracks に地上/高架/地下混在タイルの
// 全レイヤーの線路IDが入っている可能性がある（例: 地上駅なのに地下線路IDも含む）。
// 補完したelevationと一致しない線路IDが残っていると、列車配置(placeTrain)が誤ったIDを
// 選んだり、新しい到着判定（elevation一致チェック）でその駅へ永遠に到着できなくなるため、
// ロード済みのtracksマップと突き合わせて駅と同じelevationの線路IDのみに絞り込み直す
// （P2-5修正以降のセーブは元々絞り込み済みのため、フィルタしても結果は変わらない）
function normalizeStation(s: Station, tracks: Map<string, TrackSegment>): Station {
  const type = (s as unknown as Partial<Station>).type ?? 'ground_small';
  const defaultElevation = type === 'underground' ? -1 : type === 'elevated' ? 1 : 0;
  const savedElevation = (s as unknown as Partial<Station>).elevation;
  let elevation = savedElevation ?? defaultElevation;

  // v1.0で地下線路のelevationクランプ（Math.max(0, elevation)）を撤廃する前のセーブでは、
  // 地下線路ツールで敷設した区間は必ずelevation:0として直列化されていた
  // （Math.max(0, -1) === 0という決まった結果。駅側は既にtype:'underground'で保存されている）。
  // station.elevationが存在しない（＝旧セーブ由来）場合に限り、type由来の推定elevationが
  // 実際の接続線路のどれにも存在しなければ、空リストを返す代わりに実際に接続されている
  // 線路のelevationを駅のelevationとして採用し直す。「セーブに実際に入っている線路との
  // 整合」を「typeからの理論値」より優先することで、旧・地下鉄駅の接続が全滅するのを防ぐ。
  //
  // このとき、type==='underground'の駅に限り、単純なセグメント数の多数決より先に
  // 「elevation:0が接続線路に含まれるか」を優先して見る（P2-E/P2-F）。旧地下鉄駅が高架線と
  // 交差するタイルにある場合、レガシーなconnectedTracksには全レイヤーのIDが混在しており、
  // 例えば地下鉄の終端線1本(クランプによりelevation:0で記録)+高架のスルー線2本(elevation:1、
  // クランプの影響を受けないため正しい値)のような構成では、セグメント数の多数決だと本来
  // 無関係な高架線(2本)へ誤って駅を紐づけてしまう。クランプの既知の結果であるelevation:0を
  // 優先することで、これを回避する。
  // 「クランプは常に-1を0にする」という根拠はunderground駅にしか成り立たない（elevated駅の
  // elevation:1はMath.max(0, elevation)の影響を受けず、クランプによる書き換えが起こり得ない）
  // ため、この優先ルールはtype==='underground'の場合のみに限定する。それ以外の駅タイプで
  // type由来のelevationが接続線路に無い場合は、従来通りセグメント数の多数決にフォールバックする
  if (savedElevation === undefined) {
    const connectedElevations = s.connectedTracks
      .map(tid => tracks.get(tid)?.elevation)
      .filter((e): e is number => e !== undefined);
    if (connectedElevations.length > 0 && !connectedElevations.includes(elevation)) {
      if (type === 'underground' && connectedElevations.includes(0)) {
        elevation = 0;
      } else {
        const counts = new Map<number, number>();
        for (const e of connectedElevations) counts.set(e, (counts.get(e) ?? 0) + 1);
        let bestElevation = elevation;
        let bestCount = -1;
        for (const [e, count] of counts) {
          if (count > bestCount) { bestCount = count; bestElevation = e; }
        }
        elevation = bestElevation;
      }
    }
  }

  const connectedTracks = s.connectedTracks.filter(tid => (tracks.get(tid)?.elevation ?? 0) === elevation);
  return { ...s, type, elevation, connectedTracks };
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

  // stationのconnectedTracks絞り込み(normalizeStation)にelevation情報が必要なため、
  // tracksをstationsより先に構築する
  const tracks = new Map<string, TrackSegment>();
  for (const [id, t] of data.tracks) {
    tracks.set(id, {
      ...t,
      direction: (t as unknown as Partial<TrackSegment>).direction ?? (t.startZ === t.endZ ? 'E' : 'S'),
      elevation: (t as unknown as Partial<TrackSegment>).elevation ?? 0,
    });
  }

  const stations = new Map<string, Station>();
  for (const [id, s] of data.stations) {
    stations.set(id, normalizeStation(s, tracks));
  }

  const subsidiaries = new Map<string, Subsidiary>();
  for (const [id, s] of data.subsidiaries) {
    subsidiaries.set(id, { ...s, level: (s as unknown as Partial<Subsidiary>).level ?? 1 });
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

  // stationのconnectedTracks絞り込み(normalizeStation)にelevation情報が必要なため、
  // tracksを先に構築しておく
  const tracks = new Map(data.tracks);

  return {
    map: data.map,
    tracks,
    stations: new Map(data.stations.map(([id, s]) => [id, normalizeStation(s, tracks)])),
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

  // stationのconnectedTracks絞り込み(normalizeStation)にelevation情報が必要なため、
  // tracksを先に構築しておく
  const tracks = new Map(data.tracks);

  return {
    map: data.map,
    tracks,
    stations: new Map(data.stations.map(([id, s]) => [id, normalizeStation(s, tracks)])),
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

  // stationのconnectedTracks絞り込み(normalizeStation)にelevation情報が必要なため、
  // tracksを先に構築しておく
  const tracks = new Map(data.tracks);

  return {
    map: data.map,
    tracks,
    stations: new Map(data.stations.map(([id, s]) => [id, normalizeStation(s, tracks)])),
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
