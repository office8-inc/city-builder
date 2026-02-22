import type {
  GameState,
  TrackSegment,
  Station,
  Train,
  Subsidiary,
  SubsidiaryType,
  Direction,
} from './types.ts';
import {
  TRACK_COSTS,
  STATION_COSTS,
  TRAIN_TYPES,
  SUBSIDIARY_COSTS,
  formatMoney,
} from './constants.ts';

let nextEntityId = 1;
export function genId(prefix: string): string {
  return `${prefix}_${nextEntityId++}`;
}

// === Station Name Generator ===
const STATION_PREFIXES = [
  '新', '東', '西', '南', '北', '中', '上', '大', '小', '高',
  '長', '広', '青', '白', '緑', '金', '銀', '朝', '夕', '春',
];
const STATION_SUFFIXES = [
  '田', '川', '山', '丘', '谷', '橋', '森', '原', '沢', '浜',
  '崎', '島', '池', '松', '杉', '桜', '梅', '野', '町', '里',
];
let stationNameCounter = 0;
function generateStationName(): string {
  const p = STATION_PREFIXES[stationNameCounter % STATION_PREFIXES.length];
  const s = STATION_SUFFIXES[Math.floor(stationNameCounter / STATION_PREFIXES.length) % STATION_SUFFIXES.length];
  stationNameCounter++;
  return p + s;
}

type SetFn = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type GetFn = () => GameState;

export function createPlaceTrack(set: SetFn, get: GetFn) {
  return (startX: number, startZ: number, endX: number, endZ: number) => {
    const state = get();
    const { map, tracks, finance } = state;

    const dx = endX - startX;
    const dz = endZ - startZ;

    let finalEndX: number, finalEndZ: number;
    if (Math.abs(dx) >= Math.abs(dz)) {
      finalEndX = endX; finalEndZ = startZ;
    } else {
      finalEndX = startX; finalEndZ = endZ;
    }

    const segmentDefs: Array<{ sx: number; sz: number; ex: number; ez: number }> = [];

    if (finalEndZ === startZ && finalEndX !== startX) {
      const step = finalEndX > startX ? 1 : -1;
      for (let x = startX; x !== finalEndX; x += step) {
        const sx = Math.min(x, x + step);
        const ex = Math.max(x, x + step);
        segmentDefs.push({ sx, sz: startZ, ex, ez: startZ });
      }
    } else if (finalEndX === startX && finalEndZ !== startZ) {
      const step = finalEndZ > startZ ? 1 : -1;
      for (let z = startZ; z !== finalEndZ; z += step) {
        const sz = Math.min(z, z + step);
        const ez = Math.max(z, z + step);
        segmentDefs.push({ sx: startX, sz, ex: startX, ez });
      }
    }

    if (segmentDefs.length === 0) return;

    for (const seg of segmentDefs) {
      const tile1 = map[seg.sx]?.[seg.sz];
      const tile2 = map[seg.ex]?.[seg.ez];
      if (!tile1 || !tile2) { get().addNotification('マップ外には敷設できません'); return; }
      if (tile1.terrain === 'water' || tile2.terrain === 'water') { get().addNotification('水上に線路は敷設できません'); return; }
    }

    const newSegments: typeof segmentDefs = [];
    for (const seg of segmentDefs) {
      let exists = false;
      for (const existing of tracks.values()) {
        if (existing.startX === seg.sx && existing.startZ === seg.sz && existing.endX === seg.ex && existing.endZ === seg.ez) {
          exists = true; break;
        }
      }
      if (!exists) newSegments.push(seg);
    }

    if (newSegments.length === 0) { get().addNotification('既に線路が敷設されています'); return; }

    const cost = newSegments.length * TRACK_COSTS.straight;
    if (finance.cash < cost) { get().addNotification('資金が不足しています'); return; }

    const newTracks = new Map(tracks);
    for (const seg of newSegments) {
      const id = genId('track');
      const direction: Direction = seg.sz === seg.ez ? 'E' : 'S';
      const trackSeg: TrackSegment = { id, startX: seg.sx, startZ: seg.sz, endX: seg.ex, endZ: seg.ez, type: 'straight', direction, elevation: 0 };
      newTracks.set(id, trackSeg);
      map[seg.sx][seg.sz].trackIds.push(id);
      map[seg.ex][seg.ez].trackIds.push(id);
    }

    set({ tracks: newTracks, finance: { ...finance, cash: finance.cash - cost } });
    get().addNotification(`線路を${newSegments.length}区間敷設 (${formatMoney(cost)})`);
  };
}

export function createBuildStation(set: SetFn, get: GetFn) {
  return (x: number, z: number) => {
    const state = get();
    const { map, stations, finance } = state;
    const tile = map[x]?.[z];
    if (!tile) return;
    if (tile.trackIds.length === 0) { get().addNotification('線路の上にのみ駅を建設できます'); return; }
    if (tile.stationId) { get().addNotification('この場所には既に駅があります'); return; }
    const cost = STATION_COSTS.ground;
    if (finance.cash < cost) { get().addNotification('資金が不足しています'); return; }

    const id = genId('station');
    const name = generateStationName();
    const station: Station = { id, name, x, z, platforms: 1, platformLength: 1, type: 'ground', connectedTracks: [...tile.trackIds], dailyPassengers: 0, influenceRadius: 5, activityLevel: 0 };
    const newStations = new Map(stations);
    newStations.set(id, station);
    const stationCount = newStations.size;
    for (const s of newStations.values()) s.dailyPassengers = stationCount * 100;
    tile.stationId = id;
    set({ stations: newStations, finance: { ...finance, cash: finance.cash - cost } });
    get().addNotification(`${name}駅を建設 (${formatMoney(cost)})`);
  };
}

export function createPlaceTrain(set: SetFn, get: GetFn) {
  return (stationId: string) => {
    const state = get();
    const { stations, trains, finance } = state;
    const station = stations.get(stationId);
    if (!station) return;
    const trainType = TRAIN_TYPES.local;
    const cost = trainType.cost;
    if (finance.cash < cost) { get().addNotification('資金が不足しています'); return; }
    const trackId = station.connectedTracks[0];
    if (!trackId) { get().addNotification('駅に接続された線路がありません'); return; }

    const id = genId('train');
    const trainNumber = trains.size + 1;
    const train: Train = { id, name: `普通${trainNumber}号`, type: 'local', color: trainType.color, cars: trainType.cars, maxSpeed: trainType.maxSpeed, currentSegmentId: trackId, positionOnSegment: 0.5, speed: trainType.maxSpeed, direction: 1, passengers: Math.min(trainType.capacity, stations.size * 50), capacity: trainType.capacity, schedule: { stops: [], currentStopIndex: 0, loopMode: 'bounce' }, state: 'running' };
    const newTrains = new Map(trains);
    newTrains.set(id, train);
    set({ trains: newTrains, finance: { ...finance, cash: finance.cash - cost } });
    get().addNotification(`${train.name}を配置 (${formatMoney(cost)})`);
  };
}

export function createBuildSubsidiary(set: SetFn, get: GetFn) {
  return (x: number, z: number) => {
    const state = get();
    const { map, subsidiaries, finance, selectedSubsidiaryType } = state;
    if (!selectedSubsidiaryType) { get().addNotification('子会社の種類を選択してください'); return; }
    const tile = map[x]?.[z];
    if (!tile) return;
    if (tile.terrain !== 'flat') { get().addNotification('平地にのみ建設できます'); return; }
    if (tile.trackIds.length > 0 || tile.stationId || tile.buildingId || tile.subsidiaryId) { get().addNotification('この場所には建設できません'); return; }
    const costInfo = SUBSIDIARY_COSTS[selectedSubsidiaryType];
    if (finance.cash < costInfo.build) { get().addNotification('資金が不足しています'); return; }

    const SUBSIDIARY_NAMES: Record<SubsidiaryType, string> = { factory: '工場', depot: '車両基地', hotel: 'ホテル', department_store: 'デパート', power_plant: '発電所' };
    const id = genId('sub');
    const sub: Subsidiary = { id, x, z, type: selectedSubsidiaryType, name: SUBSIDIARY_NAMES[selectedSubsidiaryType], buildCost: costInfo.build, monthlyRevenue: costInfo.revenue, monthlyExpense: costInfo.monthly };
    const newSubs = new Map(subsidiaries);
    newSubs.set(id, sub);
    tile.subsidiaryId = id;
    set({ subsidiaries: newSubs, finance: { ...finance, cash: finance.cash - costInfo.build } });
    get().addNotification(`${sub.name}を建設 (${formatMoney(costInfo.build)})`);
  };
}
