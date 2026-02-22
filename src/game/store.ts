import { create } from 'zustand';
import type {
  GameState,
  ToolType,
  GameSpeed,
  CameraMode,
  TrackSegment,
  Station,
  Train,
  Building,
  Subsidiary,
  SubsidiaryType,
  Finance,
  GameTime,
  QuarterlyRecord,
} from './types.ts';
import { GRID_SIZE, INITIAL_CASH, INITIAL_YEAR, formatMoney } from './constants.ts';
import { generateTerrain } from './terrain.ts';
import { advanceTime, calculateDailyFinance } from './simulation.ts';
import { advanceTrainPosition } from './trackUtils.ts';
import { developCity, levelUpBuildings, calculatePopulation } from './cityDevelopment.ts';
import { saveToLocalStorage, loadFromLocalStorage } from './saveLoad.ts';
import { createPlaceTrack, createBuildStation, createPlaceTrain, createBuildSubsidiary } from './actions.ts';

let nextNotificationId = 1;

// Train movement speed: position units per tick (each tick = 10 game minutes)
const TRAIN_MOVE_SPEED = 0.03;

const initialFinance: Finance = {
  cash: INITIAL_CASH,
  debt: 0,
  quarterlyIncome: { railFare: 0, subsidiary: 0, other: 0 },
  quarterlyExpenses: { trackMaintenance: 0, trainMaintenance: 0, staffCost: 0, subsidiaryRunning: 0, interestPayment: 0 },
};

const initialTime: GameTime = {
  year: INITIAL_YEAR, month: 4, day: 1, hour: 6, minute: 0,
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
  quarterlyHistory: [],

  // Time
  gameTime: { ...initialTime },
  speed: 1,

  // Development tracking
  lastDevelopmentDay: 0,
  lastLevelUpMonth: 0,
  lastAutoSaveDay: 0,

  // UI
  selectedTool: 'none',
  selectedSubsidiaryType: null,
  hoveredTile: null,
  notifications: [],
  showFinancePanel: false,

  // Camera
  cameraMode: 'free',
  followTrainId: null,

  // === Actions ===
  setSpeed: (speed: GameSpeed) => set({ speed }),
  setSelectedTool: (tool: ToolType) => set({ selectedTool: tool }),
  setSelectedSubsidiaryType: (type: SubsidiaryType | null) => set({ selectedSubsidiaryType: type }),
  setHoveredTile: (tile) => set({ hoveredTile: tile }),

  addNotification: (message: string) => {
    const id = nextNotificationId++;
    set(state => ({
      notifications: [...state.notifications.slice(-4), { id, message, timestamp: Date.now() }],
    }));
    setTimeout(() => { get().dismissNotification(id); }, 4000);
  },

  dismissNotification: (id: number) => {
    set(state => ({ notifications: state.notifications.filter(n => n.id !== id) }));
  },

  tick: () => {
    const state = get();
    if (state.speed === 0) return;

    const newTime = advanceTime(state.gameTime, 10);

    // Move trains
    for (const train of state.trains.values()) {
      if (train.state !== 'running') continue;
      const update = advanceTrainPosition(train, state.tracks, TRAIN_MOVE_SPEED);
      train.positionOnSegment = update.positionOnSegment;
      train.currentSegmentId = update.currentSegmentId;
      train.direction = update.direction;
    }

    const updates: Partial<GameState> = { gameTime: newTime };

    // Daily updates at hour 0
    const dayId = newTime.year * 10000 + newTime.month * 100 + newTime.day;
    if (newTime.hour === 0 && newTime.minute === 0 && dayId !== state.lastDevelopmentDay) {
      updates.lastDevelopmentDay = dayId;

      // Update station activity
      for (const station of state.stations.values()) {
        station.activityLevel = Math.min(100, state.trains.size * 15 + state.stations.size * 5);
        station.dailyPassengers = state.stations.size * 100 + state.trains.size * 200;
      }
      for (const train of state.trains.values()) {
        train.passengers = Math.min(train.capacity, state.stations.size * 50);
      }

      // Auto city development
      if (state.stations.size > 0) {
        const newBuildings = developCity(state);
        if (newBuildings.length > 0) {
          const updatedBuildings = new Map(state.buildings);
          for (const b of newBuildings) updatedBuildings.set(b.id, b);
          updates.buildings = updatedBuildings;
        }
      }

      // Daily financial calculations
      updates.finance = calculateDailyFinance(state, updates.buildings || state.buildings);

      // Auto-save every 5 in-game days
      if (dayId % 5 === 0 && dayId !== state.lastAutoSaveDay) {
        updates.lastAutoSaveDay = dayId;
        setTimeout(() => saveToLocalStorage(useGameStore.getState()), 0);
      }
    }

    // Monthly updates (day 1, hour 0)
    const monthId = newTime.year * 100 + newTime.month;
    if (newTime.day === 1 && newTime.hour === 0 && newTime.minute === 0 && monthId !== state.lastLevelUpMonth) {
      updates.lastLevelUpMonth = monthId;
      levelUpBuildings(state);

      const buildings = updates.buildings || state.buildings;
      updates.population = calculatePopulation(buildings);

      // Quarterly report: every 3 months
      if ((newTime.month - 1) % 3 === 0) {
        const finance = updates.finance ? { ...updates.finance } : { ...state.finance };
        const qi = finance.quarterlyIncome;
        const qe = finance.quarterlyExpenses;
        const totalIncome = qi.railFare + qi.subsidiary + qi.other;
        const totalExpenses = qe.trackMaintenance + qe.trainMaintenance + qe.staffCost + qe.subsidiaryRunning + qe.interestPayment;

        const record: QuarterlyRecord = {
          year: newTime.month === 1 ? newTime.year - 1 : newTime.year,
          quarter: newTime.month === 1 ? 4 : Math.ceil((newTime.month - 1) / 3),
          income: totalIncome, expenses: totalExpenses,
        };

        updates.quarterlyHistory = [...(state.quarterlyHistory || []), record].slice(-8);

        const net = totalIncome - totalExpenses;
        get().addNotification(`📊 Q${record.quarter} ${record.year}年 決算: 収入${formatMoney(totalIncome)} 支出${formatMoney(totalExpenses)} 損益${formatMoney(net)}`);

        finance.quarterlyIncome = { railFare: 0, subsidiary: 0, other: 0 };
        finance.quarterlyExpenses = { trackMaintenance: 0, trainMaintenance: 0, staffCost: 0, subsidiaryRunning: 0, interestPayment: 0 };
        updates.finance = finance;
      }

      if (!updates.buildings) updates.buildings = new Map(state.buildings);
    }

    // Update population
    if (!updates.population) {
      updates.population = calculatePopulation(updates.buildings || state.buildings);
    }

    set(updates as GameState);
  },

  placeTrack: createPlaceTrack(set, get),
  buildStation: createBuildStation(set, get),
  placeTrain: createPlaceTrain(set, get),
  buildSubsidiary: createBuildSubsidiary(set, get),

  toggleFinancePanel: () => set(s => ({ showFinancePanel: !s.showFinancePanel })),

  saveGame: () => {
    saveToLocalStorage(get());
    get().addNotification('💾 ゲームをセーブしました');
  },

  loadGame: () => {
    const loaded = loadFromLocalStorage();
    if (loaded) {
      set(loaded as GameState);
      get().addNotification('📂 ゲームをロードしました');
    } else {
      get().addNotification('セーブデータが見つかりません');
    }
  },

  setCameraMode: (mode: CameraMode) => {
    if (mode === 'free') {
      set({ cameraMode: 'free', followTrainId: null });
    } else {
      const state = get();
      const firstTrainId = state.trains.keys().next().value ?? null;
      set({ cameraMode: 'follow', followTrainId: firstTrainId ?? null });
    }
  },

  setFollowTrainId: (id: string | null) => set({ followTrainId: id }),
}));
