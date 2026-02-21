import { create } from 'zustand';
import type {
  GameState,
  ToolType,
  GameSpeed,
  TrackSegment,
  Station,
  Train,
  Building,
  Subsidiary,
  Finance,
  GameTime,
  Direction,
} from './types.ts';
import {
  GRID_SIZE,
  INITIAL_CASH,
  INITIAL_YEAR,
  TRACK_COSTS,
  STATION_COSTS,
  TRAIN_TYPES,
  formatMoney,
} from './constants.ts';
import { generateTerrain } from './terrain.ts';
import { advanceTime } from './simulation.ts';
import { advanceTrainPosition } from './trackUtils.ts';

let nextNotificationId = 1;
let nextEntityId = 1;
function genId(prefix: string): string {
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

// Train movement speed: position units per tick (each tick = 10 game minutes)
const TRAIN_MOVE_SPEED = 0.03;

const initialFinance: Finance = {
  cash: INITIAL_CASH,
  debt: 0,
  quarterlyIncome: { railFare: 0, subsidiary: 0, other: 0 },
  quarterlyExpenses: {
    trackMaintenance: 0,
    trainMaintenance: 0,
    staffCost: 0,
    subsidiaryRunning: 0,
    interestPayment: 0,
  },
};

const initialTime: GameTime = {
  year: INITIAL_YEAR,
  month: 4,
  day: 1,
  hour: 6,
  minute: 0,
};

export const useGameStore = create<GameState>((set, get) => ({
  // Map
  map: generateTerrain(42),
  mapSize: GRID_SIZE,

  // Entities
  tracks: new Map<string, TrackSegment>(),
  stations: new Map<string, Station>(),
  trains: new Map<string, Train>(),
  buildings: new Map<string, Building>(),
  subsidiaries: new Map<string, Subsidiary>(),

  // Economy
  finance: { ...initialFinance },
  population: 0,

  // Time
  gameTime: { ...initialTime },
  speed: 1,

  // UI
  selectedTool: 'none',
  hoveredTile: null,
  notifications: [],

  // === Actions ===

  setSpeed: (speed: GameSpeed) => set({ speed }),

  setSelectedTool: (tool: ToolType) => set({ selectedTool: tool }),

  setHoveredTile: (tile) => set({ hoveredTile: tile }),

  addNotification: (message: string) => {
    const id = nextNotificationId++;
    set(state => ({
      notifications: [...state.notifications.slice(-4), { id, message, timestamp: Date.now() }],
    }));
    setTimeout(() => {
      get().dismissNotification(id);
    }, 4000);
  },

  dismissNotification: (id: number) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id),
    }));
  },

  tick: () => {
    const state = get();
    if (state.speed === 0) return;

    const minutesPerTick = 10;
    const newTime = advanceTime(state.gameTime, minutesPerTick);

    // Move trains (mutate in place — visual reads via getState() in useFrame)
    for (const train of state.trains.values()) {
      if (train.state !== 'running') continue;
      const update = advanceTrainPosition(train, state.tracks, TRAIN_MOVE_SPEED);
      train.positionOnSegment = update.positionOnSegment;
      train.currentSegmentId = update.currentSegmentId;
      train.direction = update.direction;
    }

    // Update passenger counts once per day at 6:00
    if (newTime.hour === 6 && newTime.minute === 0) {
      const stationCount = state.stations.size;
      for (const station of state.stations.values()) {
        station.dailyPassengers = stationCount * 100;
      }
      for (const train of state.trains.values()) {
        train.passengers = Math.min(train.capacity, stationCount * 50);
      }
    }

    set({ gameTime: newTime });
  },

  placeTrack: (startX: number, startZ: number, endX: number, endZ: number) => {
    const state = get();
    const { map, tracks, finance } = state;

    // Determine dominant direction and snap to cardinal axis
    const dx = endX - startX;
    const dz = endZ - startZ;

    let finalEndX: number, finalEndZ: number;
    if (Math.abs(dx) >= Math.abs(dz)) {
      finalEndX = endX;
      finalEndZ = startZ;
    } else {
      finalEndX = startX;
      finalEndZ = endZ;
    }

    // Build list of individual segments (each connecting two adjacent tiles)
    const segmentDefs: Array<{ sx: number; sz: number; ex: number; ez: number }> = [];

    if (finalEndZ === startZ && finalEndX !== startX) {
      // E-W track
      const step = finalEndX > startX ? 1 : -1;
      for (let x = startX; x !== finalEndX; x += step) {
        const sx = Math.min(x, x + step);
        const ex = Math.max(x, x + step);
        segmentDefs.push({ sx, sz: startZ, ex, ez: startZ });
      }
    } else if (finalEndX === startX && finalEndZ !== startZ) {
      // N-S track
      const step = finalEndZ > startZ ? 1 : -1;
      for (let z = startZ; z !== finalEndZ; z += step) {
        const sz = Math.min(z, z + step);
        const ez = Math.max(z, z + step);
        segmentDefs.push({ sx: startX, sz, ex: startX, ez });
      }
    }

    if (segmentDefs.length === 0) return;

    // Validate terrain (all-or-nothing)
    for (const seg of segmentDefs) {
      const tile1 = map[seg.sx]?.[seg.sz];
      const tile2 = map[seg.ex]?.[seg.ez];
      if (!tile1 || !tile2) {
        get().addNotification('マップ外には敷設できません');
        return;
      }
      if (tile1.terrain === 'water' || tile2.terrain === 'water') {
        get().addNotification('水上に線路は敷設できません');
        return;
      }
    }

    // Filter out segments that already exist
    const newSegments: typeof segmentDefs = [];
    for (const seg of segmentDefs) {
      let exists = false;
      for (const existing of tracks.values()) {
        if (
          existing.startX === seg.sx && existing.startZ === seg.sz &&
          existing.endX === seg.ex && existing.endZ === seg.ez
        ) {
          exists = true;
          break;
        }
      }
      if (!exists) newSegments.push(seg);
    }

    if (newSegments.length === 0) {
      get().addNotification('既に線路が敷設されています');
      return;
    }

    // Check cost
    const cost = newSegments.length * TRACK_COSTS.straight;
    if (finance.cash < cost) {
      get().addNotification('資金が不足しています');
      return;
    }

    // Create track segments
    const newTracks = new Map(tracks);
    for (const seg of newSegments) {
      const id = genId('track');
      const direction: Direction = seg.sz === seg.ez ? 'E' : 'S';
      const trackSeg: TrackSegment = {
        id,
        startX: seg.sx,
        startZ: seg.sz,
        endX: seg.ex,
        endZ: seg.ez,
        type: 'straight',
        direction,
        elevation: 0,
      };
      newTracks.set(id, trackSeg);

      // Mutate map tiles in place (trackIds array)
      map[seg.sx][seg.sz].trackIds.push(id);
      map[seg.ex][seg.ez].trackIds.push(id);
    }

    set({
      tracks: newTracks,
      finance: { ...finance, cash: finance.cash - cost },
    });

    get().addNotification(`線路を${newSegments.length}区間敷設 (${formatMoney(cost)})`);
  },

  buildStation: (x: number, z: number) => {
    const state = get();
    const { map, stations, finance } = state;

    const tile = map[x]?.[z];
    if (!tile) return;

    if (tile.trackIds.length === 0) {
      get().addNotification('線路の上にのみ駅を建設できます');
      return;
    }

    if (tile.stationId) {
      get().addNotification('この場所には既に駅があります');
      return;
    }

    const cost = STATION_COSTS.ground;
    if (finance.cash < cost) {
      get().addNotification('資金が不足しています');
      return;
    }

    const id = genId('station');
    const name = generateStationName();

    const station: Station = {
      id,
      name,
      x,
      z,
      platforms: 1,
      platformLength: 1,
      type: 'ground',
      connectedTracks: [...tile.trackIds],
      dailyPassengers: 0,
      influenceRadius: 5,
      activityLevel: 0,
    };

    const newStations = new Map(stations);
    newStations.set(id, station);

    // Update passenger counts for all stations (network effect)
    const stationCount = newStations.size;
    for (const s of newStations.values()) {
      s.dailyPassengers = stationCount * 100;
    }

    // Mutate map tile in place
    tile.stationId = id;

    set({
      stations: newStations,
      finance: { ...finance, cash: finance.cash - cost },
    });

    get().addNotification(`${name}駅を建設 (${formatMoney(cost)})`);
  },

  placeTrain: (stationId: string) => {
    const state = get();
    const { stations, trains, finance } = state;

    const station = stations.get(stationId);
    if (!station) return;

    const trainType = TRAIN_TYPES.local;
    const cost = trainType.cost;

    if (finance.cash < cost) {
      get().addNotification('資金が不足しています');
      return;
    }

    // Find a track connected to this station
    const trackId = station.connectedTracks[0];
    if (!trackId) {
      get().addNotification('駅に接続された線路がありません');
      return;
    }

    const id = genId('train');
    const trainNumber = trains.size + 1;

    const train: Train = {
      id,
      name: `普通${trainNumber}号`,
      type: 'local',
      color: trainType.color,
      cars: trainType.cars,
      maxSpeed: trainType.maxSpeed,
      currentSegmentId: trackId,
      positionOnSegment: 0.5,
      speed: trainType.maxSpeed,
      direction: 1,
      passengers: Math.min(trainType.capacity, stations.size * 50),
      capacity: trainType.capacity,
      schedule: { stops: [], currentStopIndex: 0, loopMode: 'bounce' },
      state: 'running',
    };

    const newTrains = new Map(trains);
    newTrains.set(id, train);

    set({
      trains: newTrains,
      finance: { ...finance, cash: finance.cash - cost },
    });

    get().addNotification(`${train.name}を配置 (${formatMoney(cost)})`);
  },
}));
