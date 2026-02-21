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
} from './types.ts';
import { GRID_SIZE, INITIAL_CASH, INITIAL_YEAR } from './constants.ts';
import { generateTerrain } from './terrain.ts';
import { advanceTime } from './simulation.ts';

let nextNotificationId = 1;
let nextEntityId = 1;
function genId(prefix: string): string {
  return `${prefix}_${nextEntityId++}`;
}

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

    // Each tick advances time by 10 minutes * speed
    const minutesPerTick = 10;
    const newTime = advanceTime(state.gameTime, minutesPerTick);

    set({ gameTime: newTime });
  },

  placeTrack: (_startX: number, _startZ: number, _endX: number, _endZ: number) => {
    // Stub — will be implemented in Step 2
    void genId;
    get().addNotification('線路敷設は次のアップデートで実装予定です');
  },

  buildStation: (_x: number, _z: number) => {
    // Stub — will be implemented in Step 2
    get().addNotification('駅建設は次のアップデートで実装予定です');
  },

  placeTrain: (_stationId: string) => {
    // Stub — will be implemented in Step 2
    get().addNotification('列車配置は次のアップデートで実装予定です');
  },
}));
