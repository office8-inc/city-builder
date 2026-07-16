import type {
  GameState,
  TrackSegment,
  Station,
  Train,
  Subsidiary,
  Direction,
  StationType,
  TrainVehicleType,
  Signal,
  TerrainType,
} from './types.ts';
import { generateStationRoads } from './materials.ts';
import { findTrainAtTile } from './trackUtils.ts';
import {
  TRACK_COSTS,
  STATION_COSTS,
  TRAIN_TYPES,
  SUBSIDIARY_COSTS,
  SUBSIDIARY_NAMES,
  LAND_PRICE_MULTIPLIER,
  getDirectionFromDelta,
  isDiagonal,
  formatMoney,
} from './constants.ts';

let nextEntityId = 1;
export function genId(prefix: string): string {
  return `${prefix}_${nextEntityId++}`;
}
export function getNextEntityId(): number { return nextEntityId; }
export function setNextEntityId(n: number) { nextEntityId = n; }

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
    const tool = state.selectedTool;
    const dx = endX - startX;
    const dz = endZ - startZ;
    if (dx === 0 && dz === 0) return;

    const elevation = tool === 'track_elevated' ? 1 : tool === 'track_underground' ? -1 : 0;
    const segmentDefs: Array<{ sx: number; sz: number; ex: number; ez: number; dir: Direction }> = [];

    if (tool === 'track_diagonal') {
      const adx = Math.abs(dx);
      const adz = Math.abs(dz);
      const diagSteps = Math.min(adx, adz);
      const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
      const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;
      let cx = startX, cz = startZ;
      for (let i = 0; i < diagSteps; i++) {
        const nx = cx + stepX, nz = cz + stepZ;
        segmentDefs.push({ sx: cx, sz: cz, ex: nx, ez: nz, dir: getDirectionFromDelta(stepX, stepZ) });
        cx = nx; cz = nz;
      }
      const remX = Math.abs(endX - cx);
      const remZ = Math.abs(endZ - cz);
      if (remX > 0) {
        const sX = endX > cx ? 1 : -1;
        for (let i = 0; i < remX; i++) {
          segmentDefs.push({ sx: cx, sz: cz, ex: cx + sX, ez: cz, dir: sX > 0 ? 'E' : 'W' });
          cx += sX;
        }
      } else if (remZ > 0) {
        const sZ = endZ > cz ? 1 : -1;
        for (let i = 0; i < remZ; i++) {
          segmentDefs.push({ sx: cx, sz: cz, ex: cx, ez: cz + sZ, dir: sZ > 0 ? 'S' : 'N' });
          cz += sZ;
        }
      }
    } else {
      let finalEndX: number, finalEndZ: number;
      if (Math.abs(dx) >= Math.abs(dz)) {
        finalEndX = endX; finalEndZ = startZ;
      } else {
        finalEndX = startX; finalEndZ = endZ;
      }
      if (finalEndZ === startZ && finalEndX !== startX) {
        const step = finalEndX > startX ? 1 : -1;
        for (let x = startX; x !== finalEndX; x += step) {
          segmentDefs.push({ sx: x, sz: startZ, ex: x + step, ez: startZ, dir: step > 0 ? 'E' : 'W' });
        }
      } else if (finalEndX === startX && finalEndZ !== startZ) {
        const step = finalEndZ > startZ ? 1 : -1;
        for (let z = startZ; z !== finalEndZ; z += step) {
          segmentDefs.push({ sx: startX, sz: z, ex: startX, ez: z + step, dir: step > 0 ? 'S' : 'N' });
        }
      }
    }

    if (segmentDefs.length === 0) return;

    for (const seg of segmentDefs) {
      const tile1 = map[seg.sx]?.[seg.sz];
      const tile2 = map[seg.ex]?.[seg.ez];
      if (!tile1 || !tile2) { get().addNotification('マップ外には敷設できません', 'error'); return; }
      // 水域には地上・高架・地下いずれの線路も敷設不可（地下線路も水底は貫通できない）
      if (tile1.terrain === 'water' || tile2.terrain === 'water') {
        get().addNotification('水上に線路は敷設できません', 'error'); return;
      }
    }

    const newSegments: typeof segmentDefs = [];
    for (const seg of segmentDefs) {
      let exists = false;
      for (const existing of tracks.values()) {
        // elevationが異なれば地上・高架・地下として共存できるため別区間として扱う
        if (existing.elevation !== elevation) continue;
        if ((existing.startX === seg.sx && existing.startZ === seg.sz && existing.endX === seg.ex && existing.endZ === seg.ez) ||
            (existing.startX === seg.ex && existing.startZ === seg.ez && existing.endX === seg.sx && existing.endZ === seg.sz)) {
          exists = true; break;
        }
      }
      if (!exists) newSegments.push(seg);
    }

    if (newSegments.length === 0) { get().addNotification('既に線路が敷設されています', 'warning'); return; }

    let cost = 0;
    for (const seg of newSegments) {
      if (elevation > 0) cost += TRACK_COSTS.elevated;
      else if (elevation < 0) cost += TRACK_COSTS.underground;
      else if (isDiagonal(seg.dir)) cost += TRACK_COSTS.diagonal;
      else cost += TRACK_COSTS.straight;
    }
    if (!state.constructionMode && finance.cash < cost) {
      get().addNotification('資金が不足しています', 'error'); return;
    }

    const newTracks = new Map(tracks);
    for (const seg of newSegments) {
      const id = genId('track');
      const trackSeg: TrackSegment = {
        id, startX: seg.sx, startZ: seg.sz, endX: seg.ex, endZ: seg.ez,
        type: 'straight', direction: seg.dir, elevation,
      };
      newTracks.set(id, trackSeg);
      if (map[seg.sx]?.[seg.sz]) map[seg.sx][seg.sz].trackIds.push(id);
      if (map[seg.ex]?.[seg.ez]) map[seg.ex][seg.ez].trackIds.push(id);
    }

    const newCash = state.constructionMode ? finance.cash : finance.cash - cost;
    set({ tracks: newTracks, finance: { ...finance, cash: newCash } });
    get().addNotification(`線路を${newSegments.length}区間敷設 (${formatMoney(cost)})`, 'success');
  };
}

export function createRemoveTrack(set: SetFn, get: GetFn) {
  return (x: number, z: number) => {
    const state = get();
    const { map, tracks, finance } = state;
    const tile = map[x]?.[z];
    if (!tile || tile.trackIds.length === 0) return;
    if (tile.stationId) { get().addNotification('駅がある場所の線路は撤去できません', 'error'); return; }

    const newTracks = new Map(tracks);
    const removedIds = [...tile.trackIds];
    for (const tid of removedIds) {
      const seg = newTracks.get(tid);
      if (seg) {
        const t1 = map[seg.startX]?.[seg.startZ];
        const t2 = map[seg.endX]?.[seg.endZ];
        if (t1) t1.trackIds = t1.trackIds.filter(id => id !== tid);
        if (t2) t2.trackIds = t2.trackIds.filter(id => id !== tid);
        newTracks.delete(tid);
      }
    }
    const refund = removedIds.length * TRACK_COSTS.remove;
    set({ tracks: newTracks, finance: { ...finance, cash: finance.cash + refund } });
    get().addNotification(`線路を${removedIds.length}区間撤去`, 'info');
  };
}

// 撤去ツールでタイルをクリックしたときに何が撤去対象になるかを判定する。
// GridHelper（プレビュー表示）とScene.tsx（確認ダイアログの要否判断）の両方から共通利用する。
export interface BulldozeTarget {
  type: 'building' | 'subsidiary' | 'station' | 'train' | null;
  id: string | null;
  name: string;
}

export function getBulldozeTarget(state: GameState, x: number, z: number): BulldozeTarget {
  const tile = state.map[x]?.[z];
  if (!tile) return { type: null, id: null, name: '' };
  if (tile.buildingId) {
    return { type: 'building', id: tile.buildingId, name: '建物' };
  }
  if (tile.subsidiaryId) {
    const sub = state.subsidiaries.get(tile.subsidiaryId);
    return { type: 'subsidiary', id: tile.subsidiaryId, name: sub?.name ?? '施設' };
  }
  if (tile.stationId) {
    const station = state.stations.get(tile.stationId);
    return { type: 'station', id: tile.stationId, name: station ? `${station.name}駅` : '駅' };
  }
  const train = findTrainAtTile(state.trains, state.tracks, x, z);
  if (train) {
    return { type: 'train', id: train.id, name: train.name };
  }
  return { type: null, id: null, name: '' };
}

export function createBulldoze(set: SetFn, get: GetFn) {
  return (x: number, z: number) => {
    const state = get();
    const { map, buildings, subsidiaries, stations, trains } = state;
    const tile = map[x]?.[z];
    if (!tile) return;
    const target = getBulldozeTarget(state, x, z);

    if (target.type === 'building' && tile.buildingId) {
      const newBuildings = new Map(buildings);
      const building = newBuildings.get(tile.buildingId);
      if (building) {
        for (let bdx = 0; bdx < building.width; bdx++) {
          for (let bdz = 0; bdz < building.depth; bdz++) {
            const t = map[building.x + bdx]?.[building.z + bdz];
            if (t) t.buildingId = null;
          }
        }
        newBuildings.delete(tile.buildingId);
        set({ buildings: newBuildings });
        get().addNotification('建物を撤去しました', 'info');
      }
    } else if (target.type === 'subsidiary' && tile.subsidiaryId) {
      const newSubs = new Map(subsidiaries);
      const sub = newSubs.get(tile.subsidiaryId);
      newSubs.delete(tile.subsidiaryId);
      tile.subsidiaryId = null;
      set({ subsidiaries: newSubs });
      get().addNotification(`${sub?.name ?? '施設'}を撤去しました`, 'info');
    } else if (target.type === 'station' && tile.stationId) {
      const newStations = new Map(stations);
      const station = newStations.get(tile.stationId);
      if (station) {
        newStations.delete(tile.stationId);
        tile.stationId = null;
        // 残りの駅の乗降客数を再計算（駅数に応じて変動する既存ロジックに合わせる）
        for (const s of newStations.values()) s.dailyPassengers = newStations.size * 100;

        // この駅を発着地点に含む列車のダイヤから撤去した駅を除去
        const newTrains = new Map(trains);
        let trainsChanged = false;
        for (const [tid, train] of newTrains) {
          if (train.schedule.stops.some(stop => stop.stationId === station.id)) {
            newTrains.set(tid, {
              ...train,
              schedule: {
                ...train.schedule,
                stops: train.schedule.stops.filter(stop => stop.stationId !== station.id),
                currentStopIndex: 0,
              },
            });
            trainsChanged = true;
          }
        }

        set({
          stations: newStations,
          trains: trainsChanged ? newTrains : trains,
        });
        get().addNotification(`${station.name}駅を撤去しました`, 'info');
      }
    } else if (target.type === 'train' && target.id) {
      const train = trains.get(target.id);
      if (train) {
        const newTrains = new Map(trains);
        newTrains.delete(target.id);
        const updates: Partial<GameState> = { trains: newTrains };
        if (state.followTrainId === target.id) {
          updates.followTrainId = null;
          updates.cameraMode = 'free';
        }
        if (state.selectedTrainId === target.id) {
          updates.selectedTrainId = null;
        }
        set(updates);
        get().addNotification(`${train.name}を撤去しました`, 'info');
      }
    }
  };
}

export function createBuildStation(set: SetFn, get: GetFn) {
  return (x: number, z: number, stationType?: StationType) => {
    const state = get();
    const { map, stations, finance, selectedTool } = state;
    const tile = map[x]?.[z];
    if (!tile) return;
    if (tile.trackIds.length === 0) { get().addNotification('線路の上にのみ駅を建設できます', 'error'); return; }
    if (tile.stationId) { get().addNotification('この場所には既に駅があります', 'error'); return; }

    let sType: StationType = stationType || 'ground_small';
    if (!stationType) {
      const toolMap: Partial<Record<string, StationType>> = {
        station_ground_small: 'ground_small', station_ground_large: 'ground_large',
        station_elevated: 'elevated', station_terminal: 'terminal',
        station_underground: 'underground', station_depot: 'depot',
        station_build: 'ground_small',
      };
      sType = toolMap[selectedTool] || 'ground_small';
    }

    // 線路の高度(elevation)と駅種別の整合性チェック:
    // 地下線路のみが通るタイルには地下鉄駅のみ、高架線路のみが通るタイルには高架駅のみ建設可能
    const trackElevations = new Set(tile.trackIds.map(tid => state.tracks.get(tid)?.elevation ?? 0));
    const onlyUnderground = trackElevations.size === 1 && trackElevations.has(-1);
    const onlyElevated = trackElevations.size > 0 && ![...trackElevations].some(e => e <= 0);
    if (onlyUnderground && sType !== 'underground') {
      get().addNotification('地下線路の上には地下鉄駅のみ建設できます', 'error'); return;
    }
    if (!onlyUnderground && sType === 'underground') {
      get().addNotification('地下鉄駅は地下線路の上にのみ建設できます', 'error'); return;
    }
    if (onlyElevated && sType !== 'elevated') {
      get().addNotification('高架線路の上には高架駅のみ建設できます', 'error'); return;
    }
    if (!onlyElevated && sType === 'elevated') {
      get().addNotification('高架駅は高架線路の上にのみ建設できます', 'error'); return;
    }

    const cost = STATION_COSTS[sType];
    if (!state.constructionMode && finance.cash < cost) {
      get().addNotification('資金が不足しています', 'error'); return;
    }

    const id = genId('station');
    const name = generateStationName();
    const platforms = sType === 'ground_large' || sType === 'terminal' ? 2 : 1;
    const station: Station = {
      id, name, x, z, platforms, platformLength: 1,
      type: sType, connectedTracks: [...tile.trackIds],
      dailyPassengers: 0, influenceRadius: 5, activityLevel: 0,
    };
    const newStations = new Map(stations);
    newStations.set(id, station);
    for (const s of newStations.values()) s.dailyPassengers = newStations.size * 100;
    tile.stationId = id;

    // Generate road network around the station
    generateStationRoads(x, z, map);

    const newCash = state.constructionMode ? finance.cash : finance.cash - cost;
    // generateStationRoadsはmapを直接ミューテートし配列参照は変わらないため、
    // Roads.tsx側の再計算トリガーとしてroadRevisionをインクリメントする
    set({ stations: newStations, finance: { ...finance, cash: newCash }, roadRevision: state.roadRevision + 1 });

    get().addNotification(`${name}駅を建設 (${formatMoney(cost)})`, 'success');
  };
}

export function createPlaceTrain(set: SetFn, get: GetFn) {
  return (stationId: string) => {
    const state = get();
    const { stations, trains, finance, selectedTrainType } = state;
    const station = stations.get(stationId);
    if (!station) return;
    const vehicleType: TrainVehicleType = selectedTrainType || 'local';
    const trainType = TRAIN_TYPES[vehicleType];
    if (!state.constructionMode && finance.cash < trainType.cost) {
      get().addNotification('資金が不足しています', 'error'); return;
    }
    const trackId = station.connectedTracks[0];
    if (!trackId) { get().addNotification('駅に接続された線路がありません', 'error'); return; }

    const id = genId('train');
    const trainNumber = trains.size + 1;
    const train: Train = {
      id, name: `${trainType.name}${trainNumber}号`, type: vehicleType,
      color: trainType.color, cars: trainType.cars, maxSpeed: trainType.maxSpeed,
      currentSegmentId: trackId, positionOnSegment: 0.5, speed: trainType.maxSpeed,
      direction: 1, passengers: Math.min(trainType.capacity, stations.size * 50),
      capacity: trainType.capacity,
      schedule: { stops: [], currentStopIndex: 0, loopMode: 'bounce' },
      state: 'running', waitTimer: 0, materialLoad: 0, terminated: false,
    };
    const newTrains = new Map(trains);
    newTrains.set(id, train);
    const newCash = state.constructionMode ? finance.cash : finance.cash - trainType.cost;
    set({ trains: newTrains, finance: { ...finance, cash: newCash } });
    get().addNotification(`${train.name}を配置 (${formatMoney(trainType.cost)})`, 'success');
  };
}

export function createBuildSubsidiary(set: SetFn, get: GetFn) {
  return (x: number, z: number) => {
    const state = get();
    const { map, subsidiaries, finance, selectedSubsidiaryType } = state;
    if (!selectedSubsidiaryType) { get().addNotification('子会社の種類を選択してください', 'warning'); return; }
    const tile = map[x]?.[z];
    if (!tile) return;
    if (tile.terrain !== 'flat' && tile.terrain !== 'hill') { get().addNotification('平地または丘陵にのみ建設できます', 'error'); return; }
    if (tile.trackIds.length > 0 || tile.stationId || tile.buildingId || tile.subsidiaryId) {
      get().addNotification('この場所には建設できません', 'error'); return;
    }
    const costInfo = SUBSIDIARY_COSTS[selectedSubsidiaryType];
    if (!state.constructionMode && finance.cash < costInfo.build) {
      get().addNotification('資金が不足しています', 'error'); return;
    }

    const id = genId('sub');
    const sub: Subsidiary = {
      id, x, z, type: selectedSubsidiaryType, name: SUBSIDIARY_NAMES[selectedSubsidiaryType],
      buildCost: costInfo.build, monthlyRevenue: costInfo.revenue, monthlyExpense: costInfo.monthly, level: 1,
    };
    const newSubs = new Map(subsidiaries);
    newSubs.set(id, sub);
    tile.subsidiaryId = id;
    const newCash = state.constructionMode ? finance.cash : finance.cash - costInfo.build;
    set({ subsidiaries: newSubs, finance: { ...finance, cash: newCash } });
    get().addNotification(`${sub.name}を建設 (${formatMoney(costInfo.build)})`, 'success');
  };
}

export function createPlaceSignal(set: SetFn, get: GetFn) {
  return (x: number, z: number) => {
    const state = get();
    const tile = state.map[x]?.[z];
    if (!tile || tile.trackIds.length === 0) {
      get().addNotification('線路の上にのみ信号を設置できます', 'error'); return;
    }
    const id = genId('signal');
    const signal: Signal = { id, x, z, segmentId: tile.trackIds[0], state: 'green' };
    const newSignals = new Map(state.signals);
    newSignals.set(id, signal);
    set({ signals: newSignals });
    get().addNotification('信号を設置しました', 'success');
  };
}

export function createBuyLand(set: SetFn, get: GetFn) {
  return (x: number, z: number) => {
    const state = get();
    const key = `${x},${z}`;
    if (state.ownedLand.has(key)) { get().addNotification('既に所有している土地です', 'warning'); return; }
    const tile = state.map[x]?.[z];
    if (!tile) return;
    const price = Math.max(1, tile.landValue) * LAND_PRICE_MULTIPLIER;
    if (!state.constructionMode && state.finance.cash < price) {
      get().addNotification('資金が不足しています', 'error'); return;
    }
    const newOwned = new Set(state.ownedLand);
    newOwned.add(key);
    const newCash = state.constructionMode ? state.finance.cash : state.finance.cash - price;
    set({ ownedLand: newOwned, finance: { ...state.finance, cash: newCash } });
    get().addNotification(`土地を購入 (${formatMoney(price)})`, 'success');
  };
}

export function createSellLand(set: SetFn, get: GetFn) {
  return (x: number, z: number) => {
    const state = get();
    const key = `${x},${z}`;
    if (!state.ownedLand.has(key)) return;
    const tile = state.map[x]?.[z];
    if (!tile) return;
    const price = Math.floor(Math.max(1, tile.landValue) * LAND_PRICE_MULTIPLIER * 0.7);
    const newOwned = new Set(state.ownedLand);
    newOwned.delete(key);
    set({ ownedLand: newOwned, finance: { ...state.finance, cash: state.finance.cash + price } });
    get().addNotification(`土地を売却 (${formatMoney(price)})`, 'success');
  };
}

export function createSetTileType(set: SetFn, get: GetFn) {
  return (x: number, z: number, terrain: TerrainType, height?: number) => {
    const state = get();
    const tile = state.map[x]?.[z];
    if (!tile) return;
    tile.terrain = terrain;
    if (height !== undefined) tile.height = height;
    const newMap = state.map.map(row => [...row]);
    set({ map: newMap });
  };
}
