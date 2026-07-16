/**
 * ショーケース街データ生成
 * タイトル画面の背景に表示する「完成形の街」を構築する
 */
import type {
  MapTile, TrackSegment, Station, Train, Building,
  Subsidiary, Signal, Direction, BuildingCategory,
  SubsidiaryType, TrainVehicleType, StationType,
} from './types.ts';
import { TRAIN_TYPES, SUBSIDIARY_COSTS, SUBSIDIARY_NAMES } from './constants.ts';
import { generateStationRoads } from './materials.ts';

// --- ID生成 ---
let scId = 0;
function id(prefix: string): string {
  return `sc_${prefix}_${++scId}`;
}

// --- ヘルパー: 直線線路区間を生成 ---
function makeTrackLine(
  sx: number, sz: number, ex: number, ez: number, dir: Direction,
): TrackSegment {
  return {
    id: id('trk'),
    startX: sx, startZ: sz, endX: ex, endZ: ez,
    type: 'straight', direction: dir, elevation: 0,
  };
}

// --- ヘルパー: 建物を生成 ---
function makeBuilding(
  x: number, z: number, type: BuildingCategory, subtype: string,
  level: number, width: number, depth: number, height: number,
  residents: number, workers: number,
): Building {
  return {
    id: id('bld'), x, z, type, subtype, level,
    width, depth, height, residents, workers,
  };
}

// --- ヘルパー: 子会社を生成 ---
function makeSub(x: number, z: number, type: SubsidiaryType): Subsidiary {
  const cost = SUBSIDIARY_COSTS[type];
  return {
    id: id('sub'), x, z, type,
    name: SUBSIDIARY_NAMES[type],
    buildCost: cost.build,
    monthlyRevenue: cost.revenue,
    monthlyExpense: cost.monthly,
    level: 1,
  };
}

// --- ヘルパー: タイルが配置可能か ---
function canPlace(map: MapTile[][], x: number, z: number, w: number, d: number): boolean {
  for (let dx = 0; dx < w; dx++) {
    for (let dz = 0; dz < d; dz++) {
      const tx = x + dx, tz = z + dz;
      if (tx < 0 || tx >= 128 || tz < 0 || tz >= 128) return false;
      const tile = map[tx][tz];
      if (tile.terrain === 'water') return false;
      if (tile.buildingId || tile.stationId || tile.subsidiaryId) return false;
      if (tile.trackIds.length > 0) return false;
    }
  }
  return true;
}

// --- ヘルパー: 建物をマップに登録 ---
function registerBuilding(map: MapTile[][], b: Building): void {
  for (let dx = 0; dx < b.width; dx++) {
    for (let dz = 0; dz < b.depth; dz++) {
      map[b.x + dx][b.z + dz].buildingId = b.id;
    }
  }
}

// --- メイン ---
export interface ShowcaseData {
  tracks: Map<string, TrackSegment>;
  stations: Map<string, Station>;
  trains: Map<string, Train>;
  buildings: Map<string, Building>;
  subsidiaries: Map<string, Subsidiary>;
  signals: Map<string, Signal>;
}

export function generateShowcaseData(map: MapTile[][]): ShowcaseData {
  // IDカウンタリセット
  scId = 0;

  const tracks = new Map<string, TrackSegment>();
  const stations = new Map<string, Station>();
  const trains = new Map<string, Train>();
  const buildings = new Map<string, Building>();
  const subsidiaries = new Map<string, Subsidiary>();
  const signals = new Map<string, Signal>();

  // ===== 1. 線路ネットワーク =====
  // 東西メイン路線: (50,64) → (78,64)
  const ewTrackIds: string[] = [];
  for (let x = 50; x < 78; x++) {
    const seg = makeTrackLine(x, 64, x + 1, 64, 'E');
    tracks.set(seg.id, seg);
    ewTrackIds.push(seg.id);
    map[x][64].trackIds.push(seg.id);
    map[x + 1][64].trackIds.push(seg.id);
  }

  // 南北メイン路線: (64,50) → (64,78)
  const nsTrackIds: string[] = [];
  for (let z = 50; z < 78; z++) {
    const seg = makeTrackLine(64, z, 64, z + 1, 'S');
    tracks.set(seg.id, seg);
    nsTrackIds.push(seg.id);
    map[64][z].trackIds.push(seg.id);
    map[64][z + 1].trackIds.push(seg.id);
  }

  // ===== 2. 駅 =====
  const stationDefs: { x: number; z: number; name: string; type: StationType; platforms: number }[] = [
    { x: 64, z: 64, name: '中央ターミナル', type: 'terminal', platforms: 2 },
    { x: 74, z: 64, name: '東栄', type: 'ground_large', platforms: 2 },
    { x: 54, z: 64, name: '西浜', type: 'ground_small', platforms: 1 },
    { x: 64, z: 54, name: '北山', type: 'ground_large', platforms: 2 },
    { x: 64, z: 74, name: '南川', type: 'ground_small', platforms: 1 },
  ];

  for (const def of stationDefs) {
    const tile = map[def.x][def.z];
    const station: Station = {
      id: id('sta'), name: def.name,
      x: def.x, z: def.z,
      platforms: def.platforms, platformLength: 1,
      type: def.type,
      connectedTracks: [...tile.trackIds],
      dailyPassengers: 2000, influenceRadius: 10, activityLevel: 80,
    };
    stations.set(station.id, station);
    tile.stationId = station.id;

    // 駅周辺に道路を自動生成
    generateStationRoads(def.x, def.z, map);
  }

  // ===== 3. 列車 =====
  const trainDefs: { type: TrainVehicleType; segIdx: number; line: string[]; pos: number }[] = [
    { type: 'local', segIdx: 3, line: ewTrackIds, pos: 0.5 },
    { type: 'suburban', segIdx: 5, line: nsTrackIds, pos: 0.5 },
    { type: 'express', segIdx: 18, line: ewTrackIds, pos: 0.3 },
    { type: 'shinkansen', segIdx: 12, line: nsTrackIds, pos: 0.7 },
  ];

  let trainNum = 1;
  for (const def of trainDefs) {
    const spec = TRAIN_TYPES[def.type];
    const segId = def.line[def.segIdx];
    if (!segId) continue;
    const train: Train = {
      id: id('trn'),
      name: `${spec.name}${trainNum}号`,
      type: def.type,
      color: spec.color,
      cars: def.type === 'shinkansen' ? 8 : spec.cars, // 新幹線は短めに
      maxSpeed: spec.maxSpeed,
      currentSegmentId: segId,
      positionOnSegment: def.pos,
      speed: spec.maxSpeed,
      direction: 1,
      passengers: Math.floor(spec.capacity * 0.6),
      capacity: spec.capacity,
      schedule: { stops: [], currentStopIndex: 0, loopMode: 'bounce' },
      state: 'running',
      waitTimer: 0,
      materialLoad: 0,
      terminated: false,
    };
    trains.set(train.id, train);
    trainNum++;
  }

  // ===== 4. 建物 =====
  // 中心部（駅から3タイル以内）: 商業・オフィス・高層
  const centerBuildings: [number, number, BuildingCategory, string, number, number, number, number, number, number][] = [
    // [x, z, type, subtype, level, w, d, h, residents, workers]
    // 中央駅周辺 — 高層ビル群
    [66, 62, 'office', 'office_tower', 3, 2, 2, 20, 0, 600],
    [62, 62, 'office', 'office_medium', 2, 1, 1, 8, 0, 200],
    [66, 66, 'commercial', 'department', 3, 3, 3, 6, 0, 300],
    [62, 66, 'office', 'skyscraper', 4, 2, 2, 40, 0, 1200],
    [60, 62, 'commercial', 'supermarket', 2, 2, 2, 2, 0, 80],
    [66, 60, 'office', 'office_small', 1, 1, 1, 3, 0, 50],
    [67, 60, 'commercial', 'convenience', 2, 1, 1, 1, 0, 10],
    [60, 66, 'commercial', 'shop_small', 1, 1, 1, 1, 0, 10],
    [60, 67, 'commercial', 'shop_small', 1, 1, 1, 1, 0, 10],
    [61, 66, 'commercial', 'convenience', 1, 1, 1, 1, 0, 10],
    [68, 62, 'office', 'office_medium', 2, 1, 1, 8, 0, 200],
    [69, 62, 'commercial', 'shop_small', 1, 1, 1, 1, 0, 10],
    [69, 63, 'commercial', 'convenience', 1, 1, 1, 1, 0, 10],
  ];

  // 東駅周辺
  const eastBuildings: [number, number, BuildingCategory, string, number, number, number, number, number, number][] = [
    [76, 62, 'commercial', 'supermarket', 2, 2, 2, 2, 0, 60],
    [76, 66, 'residential', 'apartment_small', 2, 1, 1, 3, 60, 0],
    [76, 67, 'residential', 'house_medium', 2, 1, 1, 2, 16, 0],
    [77, 62, 'commercial', 'shop_small', 1, 1, 1, 1, 0, 10],
    [77, 66, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
    [77, 67, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
    [72, 62, 'commercial', 'convenience', 1, 1, 1, 1, 0, 10],
    [72, 63, 'residential', 'apartment_small', 2, 1, 1, 3, 60, 0],
    [73, 62, 'residential', 'house_medium', 1, 1, 1, 2, 8, 0],
    [73, 66, 'office', 'office_small', 1, 1, 1, 3, 0, 50],
    [72, 66, 'commercial', 'shop_small', 1, 1, 1, 1, 0, 10],
  ];

  // 西駅周辺
  const westBuildings: [number, number, BuildingCategory, string, number, number, number, number, number, number][] = [
    [52, 62, 'residential', 'apartment_medium', 3, 2, 2, 5, 300, 0],
    [52, 66, 'residential', 'apartment_small', 2, 1, 1, 3, 60, 0],
    [52, 67, 'residential', 'house_medium', 1, 1, 1, 2, 8, 0],
    [53, 66, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
    [53, 67, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
    [51, 62, 'residential', 'house_medium', 1, 1, 1, 2, 8, 0],
    [51, 63, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
    [56, 62, 'commercial', 'shop_small', 1, 1, 1, 1, 0, 10],
    [56, 63, 'residential', 'apartment_small', 2, 1, 1, 3, 60, 0],
    [57, 62, 'residential', 'house_medium', 1, 1, 1, 2, 8, 0],
    [57, 66, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
  ];

  // 北駅周辺
  const northBuildings: [number, number, BuildingCategory, string, number, number, number, number, number, number][] = [
    [62, 52, 'office', 'office_tower', 2, 2, 2, 20, 0, 400],
    [66, 52, 'commercial', 'supermarket', 2, 2, 2, 2, 0, 60],
    [66, 56, 'residential', 'apartment_small', 2, 1, 1, 3, 60, 0],
    [66, 57, 'residential', 'house_medium', 1, 1, 1, 2, 8, 0],
    [62, 56, 'commercial', 'convenience', 1, 1, 1, 1, 0, 10],
    [63, 52, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
    [62, 57, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
    [67, 52, 'residential', 'house_medium', 1, 1, 1, 2, 8, 0],
    [67, 56, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
  ];

  // 南駅周辺
  const southBuildings: [number, number, BuildingCategory, string, number, number, number, number, number, number][] = [
    [62, 76, 'residential', 'apartment_medium', 2, 2, 2, 5, 200, 0],
    [66, 76, 'residential', 'apartment_small', 2, 1, 1, 3, 60, 0],
    [62, 72, 'commercial', 'shop_small', 1, 1, 1, 1, 0, 10],
    [63, 76, 'residential', 'house_medium', 1, 1, 1, 2, 8, 0],
    [66, 72, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
    [67, 76, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
    [62, 77, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
    [66, 77, 'residential', 'house_small', 1, 1, 1, 1, 4, 0],
  ];

  // 外周部 — 工業・農業・文化
  const outerBuildings: [number, number, BuildingCategory, string, number, number, number, number, number, number][] = [
    [50, 58, 'industrial', 'factory_small', 1, 2, 2, 2, 0, 100],
    [78, 58, 'industrial', 'warehouse', 1, 2, 3, 2, 0, 30],
    [58, 50, 'agriculture', 'farm_small', 1, 3, 3, 0, 0, 10],
    [70, 78, 'agriculture', 'farm_small', 1, 3, 3, 0, 0, 10],
    [58, 70, 'culture', 'school', 1, 3, 2, 3, 0, 50],
    [70, 58, 'culture', 'library', 1, 2, 2, 2, 0, 30],
    [50, 70, 'leisure', 'park_small', 1, 2, 2, 0, 0, 0],
    [78, 70, 'culture', 'temple', 1, 2, 2, 2, 0, 0],
  ];

  // さらに散在する住宅（外周）
  const scatteredResidential: [number, number, string, number, number][] = [
    // [x, z, subtype, residents, level]
    [50, 62, 'house_small', 4, 1],
    [50, 63, 'house_small', 4, 1],
    [50, 66, 'house_medium', 8, 1],
    [50, 67, 'house_small', 4, 1],
    [78, 62, 'house_small', 4, 1],
    [78, 63, 'house_small', 4, 1],
    [78, 66, 'house_medium', 8, 1],
    [78, 67, 'house_small', 4, 1],
    [62, 50, 'house_small', 4, 1],
    [63, 50, 'house_small', 4, 1],
    [66, 50, 'house_small', 4, 1],
    [62, 78, 'house_small', 4, 1],
    [63, 78, 'house_small', 4, 1],
    [66, 78, 'house_small', 4, 1],
    [55, 60, 'house_medium', 8, 1],
    [55, 61, 'house_small', 4, 1],
    [55, 67, 'house_small', 4, 1],
    [55, 68, 'house_small', 4, 1],
    [73, 60, 'house_small', 4, 1],
    [73, 67, 'house_small', 4, 1],
    [73, 68, 'house_small', 4, 1],
    [60, 55, 'house_small', 4, 1],
    [61, 55, 'house_small', 4, 1],
    [67, 55, 'house_small', 4, 1],
    [60, 73, 'house_small', 4, 1],
    [61, 73, 'house_small', 4, 1],
    [67, 73, 'house_small', 4, 1],
  ];

  // 全建物を配置
  const allBuildingDefs = [
    ...centerBuildings, ...eastBuildings, ...westBuildings,
    ...northBuildings, ...southBuildings, ...outerBuildings,
  ];

  for (const [bx, bz, type, subtype, level, w, d, h, res, wrk] of allBuildingDefs) {
    if (!canPlace(map, bx, bz, w, d)) continue;
    const b = makeBuilding(bx, bz, type as BuildingCategory, subtype, level, w, d, h, res, wrk);
    buildings.set(b.id, b);
    registerBuilding(map, b);
  }

  for (const [bx, bz, subtype, res, level] of scatteredResidential) {
    if (!canPlace(map, bx, bz, 1, 1)) continue;
    const h = subtype === 'house_small' ? 1 : 2;
    const b = makeBuilding(bx, bz, 'residential', subtype, level, 1, 1, h, res, 0);
    buildings.set(b.id, b);
    registerBuilding(map, b);
  }

  // ===== 5. 子会社 =====
  const subDefs: [number, number, SubsidiaryType][] = [
    [70, 70, 'hotel'],
    [58, 58, 'department_store'],
    [70, 62, 'convenience_store'],
    [58, 66, 'supermarket'],
    [50, 54, 'factory'],
    [78, 74, 'stadium'],
    [58, 76, 'broadcast_tower'],
  ];

  for (const [sx, sz, stype] of subDefs) {
    if (!canPlace(map, sx, sz, 1, 1)) continue;
    const sub = makeSub(sx, sz, stype);
    subsidiaries.set(sub.id, sub);
    map[sx][sz].subsidiaryId = sub.id;
  }

  // ===== 6. 道路を補完（建物周辺） =====
  // 線路沿い以外の場所にも道路を追加して街らしさを出す
  for (const b of buildings.values()) {
    for (let dx = -1; dx <= b.width; dx++) {
      for (let dz = -1; dz <= b.depth; dz++) {
        if (dx >= 0 && dx < b.width && dz >= 0 && dz < b.depth) continue; // 建物本体はスキップ
        const rx = b.x + dx, rz = b.z + dz;
        if (rx < 0 || rx >= 128 || rz < 0 || rz >= 128) continue;
        const tile = map[rx][rz];
        if (tile.terrain === 'water') continue;
        if (tile.buildingId || tile.stationId || tile.subsidiaryId) continue;
        if (tile.trackIds.length > 0) continue;
        if (tile.roadLevel === 0) tile.roadLevel = 1;
      }
    }
  }

  return { tracks, stations, trains, buildings, subsidiaries, signals };
}
