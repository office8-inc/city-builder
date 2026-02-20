import { create } from 'zustand';
import type { GameState, Tile, ToolType, GameSpeed } from './types.ts';
import { GRID_SIZE, INITIAL_MONEY, BUILDING_COSTS, DAYS_PER_MONTH, MONTHS_PER_YEAR } from './constants.ts';
import {
  countBuildings,
  calculateMaxPopulation,
  calculateTotalJobs,
  calculateHappiness,
  calculateDemand,
  calculateMonthlyIncome,
  calculateMonthlyExpenses,
  simulatePopulationGrowth,
  ageBuildingsAndGrow,
  createBuilding,
} from './simulation.ts';
import { isValidGridPosition } from '../utils/grid.ts';

function createInitialGrid(): Tile[][] {
  const grid: Tile[][] = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    grid[x] = [];
    for (let z = 0; z < GRID_SIZE; z++) {
      // Add some water features
      const distFromCenter = Math.sqrt((x - 45) ** 2 + (z - 45) ** 2);
      const isWater = distFromCenter < 5;
      // Add a river
      const isRiver = Math.abs(z - (32 + Math.sin(x / 5) * 3)) < 1.5 && x > 40;

      grid[x][z] = {
        terrain: isWater || isRiver ? 'water' : 'grass',
        building: null,
      };
    }
  }
  return grid;
}

let nextNotificationId = 1;

export const useGameStore = create<GameState>((set, get) => ({
  grid: createInitialGrid(),
  money: INITIAL_MONEY,
  population: 0,
  jobs: 0,
  happiness: 50,
  date: { year: 2024, month: 1, day: 1 },
  speed: 1,
  demand: { residential: 50, commercial: 30, industrial: 30 },
  selectedTool: 'none',
  notifications: [],
  hoveredTile: null,
  totalResidential: 0,
  totalCommercial: 0,
  totalIndustrial: 0,
  monthlyIncome: 0,
  monthlyExpenses: 0,

  placeBuilding: (x: number, z: number) => {
    const state = get();
    const tool = state.selectedTool;
    if (tool === 'none' || tool === 'bulldoze') return;

    if (!isValidGridPosition(x, z)) return;

    const tile = state.grid[x][z];
    if (tile.terrain === 'water') return;
    if (tile.building !== null) return;

    const cost = BUILDING_COSTS[tool];
    if (state.money < cost) {
      get().addNotification('Not enough money!');
      return;
    }

    const newGrid = state.grid.map(row => row.map(t => ({ ...t })));
    newGrid[x][z] = {
      ...newGrid[x][z],
      building: createBuilding(tool),
    };

    const counts = countBuildings(newGrid);
    const totalJobs = calculateTotalJobs(newGrid);

    set({
      grid: newGrid,
      money: state.money - cost,
      totalResidential: counts.residential,
      totalCommercial: counts.commercial,
      totalIndustrial: counts.industrial,
      jobs: totalJobs,
    });
  },

  bulldoze: (x: number, z: number) => {
    const state = get();
    if (!isValidGridPosition(x, z)) return;

    const tile = state.grid[x][z];
    if (tile.building === null) return;

    const newGrid = state.grid.map(row => row.map(t => ({ ...t })));
    newGrid[x][z] = { ...newGrid[x][z], building: null };

    const counts = countBuildings(newGrid);
    const totalJobs = calculateTotalJobs(newGrid);

    set({
      grid: newGrid,
      money: state.money + 5, // small refund
      totalResidential: counts.residential,
      totalCommercial: counts.commercial,
      totalIndustrial: counts.industrial,
      jobs: totalJobs,
    });
  },

  setSpeed: (speed: GameSpeed) => set({ speed }),

  setSelectedTool: (tool: ToolType) => set({ selectedTool: tool }),

  setHoveredTile: (tile) => set({ hoveredTile: tile }),

  addNotification: (message: string) => {
    const id = nextNotificationId++;
    set(state => ({
      notifications: [...state.notifications.slice(-4), { id, message, timestamp: Date.now() }],
    }));
    // Auto-dismiss after 4 seconds
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

    const newDate = { ...state.date };
    newDate.day++;

    let newMoney = state.money;
    let newPopulation = state.population;
    let populationMilestone = false;

    // Age buildings daily
    const newGrid = state.grid.map(row => row.map(t => ({
      ...t,
      building: t.building ? { ...t.building } : null,
    })));
    ageBuildingsAndGrow(newGrid);

    // Monthly processing
    if (newDate.day > DAYS_PER_MONTH) {
      newDate.day = 1;
      newDate.month++;

      if (newDate.month > MONTHS_PER_YEAR) {
        newDate.month = 1;
        newDate.year++;
      }

      const counts = countBuildings(newGrid);
      const maxPop = calculateMaxPopulation(newGrid);
      const totalJobs = calculateTotalJobs(newGrid);
      const happiness = calculateHappiness(
        state.population,
        totalJobs,
        counts.park,
        counts.power_plant > 0,
        counts.water_tower > 0,
      );

      // Collect taxes and pay expenses
      const income = calculateMonthlyIncome(state.population, happiness);
      const expenses = calculateMonthlyExpenses(newGrid);
      newMoney += income - expenses;

      // Population growth
      const oldPop = state.population;
      newPopulation = simulatePopulationGrowth(state.population, maxPop, totalJobs, happiness);

      // Check milestones
      const milestones = [100, 500, 1000, 2000, 5000, 10000];
      for (const m of milestones) {
        if (oldPop < m && newPopulation >= m) {
          populationMilestone = true;
          setTimeout(() => get().addNotification(`Population reached ${m.toLocaleString()}!`), 0);
        }
      }

      const demand = calculateDemand(newPopulation, counts);

      set({
        grid: newGrid,
        date: newDate,
        money: newMoney,
        population: newPopulation,
        jobs: totalJobs,
        happiness,
        demand,
        totalResidential: counts.residential,
        totalCommercial: counts.commercial,
        totalIndustrial: counts.industrial,
        monthlyIncome: income,
        monthlyExpenses: expenses,
      });

      if (newMoney < 0 && !populationMilestone) {
        get().addNotification('Warning: City is in debt!');
      }

      return;
    }

    set({
      grid: newGrid,
      date: newDate,
      money: newMoney,
      population: newPopulation,
    });
  },
}));
