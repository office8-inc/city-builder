import { create } from 'zustand';
import type {
  GameState,
  GamePhase,
  ToolType,
  GameSpeed,
  CameraMode,
  FollowMode,
  TrackSegment,
  Station,
  Train,
  Building,
  Subsidiary,
  SubsidiaryType,
  Signal,
  Loan,
  Finance,
  GameTime,
  QuarterlyRecord,
  Season,
  WeatherType,
  TrainVehicleType,
  TrainSchedule,
} from './types.ts';
import { GRID_SIZE, INITIAL_CASH, INITIAL_YEAR, LOAN_INTEREST_RATE, MAX_DEBT_RATIO, formatMoney } from './constants.ts';
import { generateTerrain } from './terrain.ts';
import { advanceTime, calculateDailyFinance } from './simulation.ts';
import { advanceTrainPosition, getStationAtPosition } from './trackUtils.ts';
import { developCity, levelUpBuildings, calculatePopulation, calculateWorkforce } from './cityDevelopment.ts';
import { processMaterialProduction, updateLandValues, generateRoads } from './materials.ts';
import { saveToLocalStorage, loadFromLocalStorage } from './saveLoad.ts';
import { updateSignals } from './signals.ts';
import {
  createPlaceTrack, createBuildStation, createPlaceTrain, createBuildSubsidiary,
  createRemoveTrack, createBulldoze, createPlaceSignal,
  createBuyLand, createSellLand, createSetTileType,
  setNextEntityId,
} from './actions.ts';
import { generateShowcaseData } from './showcase.ts';

let nextNotificationId = 1;

// Train movement speed: position units per tick (each tick = 10 game minutes)
const TRAIN_MOVE_SPEED = 0.03;

function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

const initialFinance: Finance = {
  cash: INITIAL_CASH,
  debt: 0,
  quarterlyIncome: { railFare: 0, subsidiary: 0, other: 0, landRent: 0 },
  quarterlyExpenses: { trackMaintenance: 0, trainMaintenance: 0, staffCost: 0, subsidiaryRunning: 0, interestPayment: 0 },
  stockPrice: 1000,
  totalAssets: INITIAL_CASH,
};

const initialTime: GameTime = {
  year: INITIAL_YEAR, month: 4, day: 1, hour: 10, minute: 0,
};

// タイトル画面ではショーケース街を表示
const _isAutoplay = typeof window !== 'undefined' && window.location.search.includes('autoplay');
const _initialMap = generateTerrain(42);
const _showcase = _isAutoplay ? null : generateShowcaseData(_initialMap);

export const useGameStore = create<GameState>((set, get) => ({
  // Map
  map: _initialMap,
  mapSize: GRID_SIZE,

  // Entities（タイトル画面ならショーケースデータを適用）
  tracks: _showcase?.tracks ?? new Map<string, TrackSegment>(),
  stations: _showcase?.stations ?? new Map<string, Station>(),
  trains: _showcase?.trains ?? new Map<string, Train>(),
  buildings: _showcase?.buildings ?? new Map<string, Building>(),
  subsidiaries: _showcase?.subsidiaries ?? new Map<string, Subsidiary>(),
  signals: _showcase?.signals ?? new Map<string, Signal>(),

  // Economy
  finance: { ...initialFinance },
  population: 0,
  workforce: 0,
  quarterlyHistory: [],
  loans: [],
  ownedLand: new Set<string>(),

  // Time
  gameTime: { ...initialTime },
  speed: 1,
  season: getSeason(initialTime.month),
  weatherType: 'clear',

  // Development tracking
  lastDevelopmentDay: 0,
  lastLevelUpMonth: 0,
  lastAutoSaveDay: 0,

  // Game phase
  gamePhase: (typeof window !== 'undefined' && window.location.search.includes('autoplay')) ? 'playing' : 'title',
  tutorialStep: 0,
  showHelpPanel: false,
  constructionMode: false,
  scenarioId: null,

  // UI
  selectedTool: 'none',
  selectedSubsidiaryType: null,
  selectedTrainType: 'local',
  hoveredTile: null,
  notifications: [],
  showFinancePanel: false,
  showSchedulePanel: false,
  showSettingsPanel: false,
  selectedTrainId: null,

  // Camera
  cameraMode: 'free',
  followMode: 'chase',
  followTrainId: null,

  // === Actions ===
  setSpeed: (speed: GameSpeed) => set({ speed }),
  setSelectedTool: (tool: ToolType) => set({ selectedTool: tool }),
  setSelectedSubsidiaryType: (type: SubsidiaryType | null) => set({ selectedSubsidiaryType: type }),
  setSelectedTrainType: (type: TrainVehicleType) => set({ selectedTrainType: type }),
  setHoveredTile: (tile) => set({ hoveredTile: tile }),

  addNotification: (message: string, severity: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    const id = nextNotificationId++;
    set(state => ({
      notifications: [...state.notifications.slice(-4), { id, message, timestamp: Date.now(), severity }],
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

    // Update signals
    const updatedSignals = updateSignals(state.signals, state.tracks, state.trains);

    // Move trains — immutable update (Bug #6 fix)
    let trainsUpdated = false;
    const newTrains = new Map(state.trains);
    for (const [id, train] of newTrains) {
      // Handle waiting trains
      if (train.state === 'waiting') {
        const remaining = train.waitTimer - 10; // 10 minutes per tick
        if (remaining <= 0) {
          newTrains.set(id, { ...train, state: 'running', waitTimer: 0 });
          trainsUpdated = true;
        } else {
          newTrains.set(id, { ...train, waitTimer: remaining });
          trainsUpdated = true;
        }
        continue;
      }
      if (train.state !== 'running') continue;

      const update = advanceTrainPosition(train, state.tracks, TRAIN_MOVE_SPEED, updatedSignals, state.stations);
      let updatedTrain = { ...train, ...update };

      // Check if train arrived at a station
      const stationAt = getStationAtPosition(updatedTrain, state.tracks, state.stations);
      if (stationAt && train.schedule.stops.length > 0) {
        const nextIdx = (train.schedule.currentStopIndex + 1) % train.schedule.stops.length;
        const nextStop = train.schedule.stops[nextIdx];
        if (nextStop && nextStop.stationId === stationAt.id) {
          if (nextStop.action === 'stop') {
            updatedTrain = {
              ...updatedTrain,
              state: 'waiting',
              waitTimer: nextStop.waitTime,
              schedule: { ...train.schedule, currentStopIndex: nextIdx },
            };
          } else {
            // Pass through
            updatedTrain = {
              ...updatedTrain,
              schedule: { ...train.schedule, currentStopIndex: nextIdx },
            };
          }
        }
      }

      if (updatedTrain.positionOnSegment !== train.positionOnSegment ||
          updatedTrain.currentSegmentId !== train.currentSegmentId ||
          updatedTrain.direction !== train.direction ||
          updatedTrain.state !== train.state ||
          updatedTrain.waitTimer !== train.waitTimer) {
        newTrains.set(id, updatedTrain);
        trainsUpdated = true;
      }
    }

    const updates: Partial<GameState> = { gameTime: newTime };
    if (trainsUpdated) updates.trains = newTrains;
    if (updatedSignals !== state.signals) updates.signals = updatedSignals;

    // Update season
    const newSeason = getSeason(newTime.month);
    if (newSeason !== state.season) updates.season = newSeason;

    // Daily updates at hour 0
    const dayId = newTime.year * 10000 + newTime.month * 100 + newTime.day;
    if (newTime.hour === 0 && newTime.minute === 0 && dayId !== state.lastDevelopmentDay) {
      updates.lastDevelopmentDay = dayId;

      // Weather transition (random every 3-7 days)
      const weatherRoll = (dayId * 7 + 13) % 100;
      if (weatherRoll < 15) {
        const types: WeatherType[] = ['clear', 'cloudy', 'rain'];
        const currentIdx = types.indexOf(state.weatherType);
        // Tend toward neighboring states (clear<->cloudy<->rain)
        const shift = weatherRoll < 8 ? 1 : -1;
        const newIdx = Math.max(0, Math.min(2, currentIdx + shift));
        if (newIdx !== currentIdx) {
          updates.weatherType = types[newIdx];
        }
      }

      // Update station activity (immutable)
      const updatedStations = new Map(state.stations);
      for (const [sid, station] of updatedStations) {
        updatedStations.set(sid, {
          ...station,
          activityLevel: Math.min(100, state.trains.size * 15 + state.stations.size * 5),
          dailyPassengers: state.stations.size * 100 + state.trains.size * 200,
        });
      }
      updates.stations = updatedStations;

      // Update train passengers (immutable)
      const dayTrains = updates.trains || new Map(state.trains);
      for (const [tid, train] of dayTrains) {
        dayTrains.set(tid, {
          ...train,
          passengers: Math.min(train.capacity, state.stations.size * 50),
        });
      }
      updates.trains = dayTrains;

      // Process material production
      processMaterialProduction(state);

      // Auto city development (every 2 days)
      if (state.stations.size > 0 && dayId % 2 === 0) {
        const newBuildings = developCity(state);
        if (newBuildings.length > 0) {
          const updatedBuildings = new Map(state.buildings);
          for (const b of newBuildings) {
            updatedBuildings.set(b.id, b);
            // Generate roads around new buildings
            generateRoads(b.x, b.z, state.map);
          }
          updates.buildings = updatedBuildings;
        }
        // Update land values periodically
        updateLandValues(state);
      }

      // Update workforce
      const buildings = updates.buildings || state.buildings;
      updates.workforce = calculateWorkforce(buildings);

      // Daily financial calculations
      updates.finance = calculateDailyFinance(state, buildings);

      // Process loan payments
      if (state.loans.length > 0) {
        const finance = updates.finance || { ...state.finance };
        const newLoans: Loan[] = [];
        for (const loan of state.loans) {
          if (loan.remainingMonths > 0) {
            // Daily payment = monthly / 30
            const dailyPayment = loan.monthlyPayment / 30;
            finance.cash -= Math.round(dailyPayment);
            newLoans.push(loan);
          }
        }
        updates.loans = newLoans;
        updates.finance = finance;
      }

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

      // Process monthly loan decrement
      if (state.loans.length > 0) {
        const monthLoans = (updates.loans || [...state.loans]).map(loan => ({
          ...loan,
          remainingMonths: loan.remainingMonths - 1,
        })).filter(loan => loan.remainingMonths > 0);
        updates.loans = monthLoans;

        // Update total debt
        const finance = updates.finance ? { ...updates.finance } : { ...state.finance };
        finance.debt = monthLoans.reduce((sum, l) => sum + l.monthlyPayment * l.remainingMonths, 0);
        updates.finance = finance;
      }

      // Quarterly report: every 3 months
      if ((newTime.month - 1) % 3 === 0) {
        const finance = updates.finance ? { ...updates.finance } : { ...state.finance };
        const qi = finance.quarterlyIncome;
        const qe = finance.quarterlyExpenses;
        const totalIncome = qi.railFare + qi.subsidiary + qi.other + qi.landRent;
        const totalExpenses = qe.trackMaintenance + qe.trainMaintenance + qe.staffCost + qe.subsidiaryRunning + qe.interestPayment;

        const record: QuarterlyRecord = {
          year: newTime.month === 1 ? newTime.year - 1 : newTime.year,
          quarter: newTime.month === 1 ? 4 : Math.ceil((newTime.month - 1) / 3),
          income: totalIncome, expenses: totalExpenses,
        };

        updates.quarterlyHistory = [...(state.quarterlyHistory || []), record].slice(-8);

        const net = totalIncome - totalExpenses;
        get().addNotification(
          `Q${record.quarter} ${record.year}年 決算: 収入${formatMoney(totalIncome)} 支出${formatMoney(totalExpenses)} 損益${formatMoney(net)}`,
          net >= 0 ? 'success' : 'warning'
        );

        // Update stock price
        const eps = net / 4;
        const peRatio = 10 + Math.min(state.population / 1000, 20);
        finance.stockPrice = Math.max(100, Math.round(eps * peRatio / 1000));
        finance.totalAssets = finance.cash + state.population * 10000;

        finance.quarterlyIncome = { railFare: 0, subsidiary: 0, other: 0, landRent: 0 };
        finance.quarterlyExpenses = { trackMaintenance: 0, trainMaintenance: 0, staffCost: 0, subsidiaryRunning: 0, interestPayment: 0 };
        updates.finance = finance;
      }

      // Bankruptcy check (monthly)
      if (!state.constructionMode) {
        const f = updates.finance || state.finance;
        const maxDebt = Math.max(f.totalAssets * MAX_DEBT_RATIO, INITIAL_CASH * MAX_DEBT_RATIO);
        if (f.cash < 0 && f.debt > maxDebt) {
          set({ ...updates, gamePhase: 'gameover' } as GameState);
          get().addNotification('資金が枯渇し、破産しました...', 'error');
          return;
        }
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
  removeTrack: createRemoveTrack(set, get),
  bulldoze: createBulldoze(set, get),
  placeSignal: createPlaceSignal(set, get),
  buyLand: createBuyLand(set, get),
  sellLand: createSellLand(set, get),
  setTileType: createSetTileType(set, get),

  toggleFinancePanel: () => set(s => ({ showFinancePanel: !s.showFinancePanel })),
  toggleHelpPanel: () => set(s => ({ showHelpPanel: !s.showHelpPanel })),
  toggleSchedulePanel: () => set(s => ({ showSchedulePanel: !s.showSchedulePanel })),
  toggleSettingsPanel: () => set(s => ({ showSettingsPanel: !s.showSettingsPanel })),

  setGamePhase: (phase: GamePhase) => set({ gamePhase: phase }),

  nextTutorialStep: () => {
    const state = get();
    const nextStep = state.tutorialStep + 1;
    if (nextStep >= 5) {
      set({ tutorialStep: 0, gamePhase: 'playing' });
      localStorage.setItem('atrain-tutorial-done', '1');
    } else {
      set({ tutorialStep: nextStep });
    }
  },

  skipTutorial: () => {
    set({ tutorialStep: 0, gamePhase: 'playing' });
    localStorage.setItem('atrain-tutorial-done', '1');
  },

  saveGame: (slot?: number) => {
    saveToLocalStorage(get(), slot);
    get().addNotification('ゲームをセーブしました', 'success');
  },

  loadGame: (slot?: number) => {
    const loaded = loadFromLocalStorage(slot);
    if (loaded) {
      set({ ...loaded, gamePhase: 'playing' } as GameState);
      get().addNotification('ゲームをロードしました', 'success');
    } else {
      get().addNotification('セーブデータが見つかりません', 'warning');
    }
  },

  takeLoan: (amount: number, months: number) => {
    const state = get();
    const rate = LOAN_INTEREST_RATE;
    const monthlyRate = rate / 12;
    const monthlyPayment = Math.round(amount * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1));

    const loan: Loan = {
      id: `loan_${Date.now()}`,
      principal: amount,
      interestRate: rate,
      monthlyPayment,
      remainingMonths: months,
      takenAtYear: state.gameTime.year,
      takenAtMonth: state.gameTime.month,
    };

    const newLoans = [...state.loans, loan];
    const newDebt = newLoans.reduce((sum, l) => sum + l.monthlyPayment * l.remainingMonths, 0);
    set({
      loans: newLoans,
      finance: { ...state.finance, cash: state.finance.cash + amount, debt: newDebt },
    });
    get().addNotification(`${formatMoney(amount)}を借入しました`, 'info');
  },

  repayLoan: (loanId: string) => {
    const state = get();
    const loan = state.loans.find(l => l.id === loanId);
    if (!loan) return;
    const remaining = loan.monthlyPayment * loan.remainingMonths;
    if (state.finance.cash < remaining) {
      get().addNotification('資金が不足しています', 'error');
      return;
    }
    const newLoans = state.loans.filter(l => l.id !== loanId);
    const newDebt = newLoans.reduce((sum, l) => sum + l.monthlyPayment * l.remainingMonths, 0);
    set({
      loans: newLoans,
      finance: { ...state.finance, cash: state.finance.cash - remaining, debt: newDebt },
    });
    get().addNotification(`${formatMoney(remaining)}を返済しました`, 'success');
  },

  setCameraMode: (mode: CameraMode) => {
    if (mode === 'free') {
      set({ cameraMode: 'free', followTrainId: null });
    } else if (mode === 'quarter') {
      set({ cameraMode: 'quarter' });
    } else {
      const state = get();
      const firstTrainId = state.trains.keys().next().value ?? null;
      set({ cameraMode: 'follow', followTrainId: firstTrainId ?? null });
    }
  },

  setFollowMode: (mode: FollowMode) => set({ followMode: mode }),
  setFollowTrainId: (id: string | null) => set({ followTrainId: id }),
  setSelectedTrainId: (id: string | null) => set({ selectedTrainId: id }),
  updateTrainSchedule: (trainId: string, schedule: TrainSchedule) => {
    const state = get();
    const train = state.trains.get(trainId);
    if (!train) return;
    const newTrains = new Map(state.trains);
    newTrains.set(trainId, { ...train, schedule });
    set({ trains: newTrains });
    get().addNotification(`${train.name}のダイヤを更新しました`, 'success');
  },
  setConstructionMode: (mode: boolean) => set({ constructionMode: mode }),
  setScenarioId: (id: string | null) => set({ scenarioId: id }),
  setWeatherType: (type: WeatherType) => set({ weatherType: type }),

  // ショーケースデータをクリアして新規ゲーム用に初期化
  resetForNewGame: (seed?: number) => {
    const newMap = generateTerrain(seed ?? 42);
    setNextEntityId(1);
    set({
      map: newMap,
      tracks: new Map(),
      stations: new Map(),
      trains: new Map(),
      buildings: new Map(),
      subsidiaries: new Map(),
      signals: new Map(),
      ownedLand: new Set<string>(),
      loans: [],
      finance: { ...initialFinance },
      population: 0,
      workforce: 0,
      quarterlyHistory: [],
      gameTime: { ...initialTime },
      speed: 1,
      season: getSeason(initialTime.month),
      weatherType: 'clear',
      lastDevelopmentDay: 0,
      lastLevelUpMonth: 0,
      lastAutoSaveDay: 0,
      selectedTool: 'none',
      selectedTrainId: null,
      followTrainId: null,
      notifications: [],
    });
  },
}));

// 開発時のみ: ブラウザコンソールからストアにアクセス
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__gameStore = useGameStore;
}