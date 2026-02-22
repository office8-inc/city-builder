import type {
  GameState,
  TrackSegment,
  Station,
  Train,
  Building,
  Subsidiary,
  MapTile,
  Finance,
  GameTime,
  GameSpeed,
  QuarterlyRecord,
} from './types.ts';

interface SerializedState {
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

const SAVE_KEY = 'atrain-city-save';

export function serializeState(state: GameState): string {
  const data: SerializedState = {
    version: 1,
    map: state.map,
    tracks: Array.from(state.tracks.entries()),
    stations: Array.from(state.stations.entries()),
    trains: Array.from(state.trains.entries()),
    buildings: Array.from(state.buildings.entries()),
    subsidiaries: Array.from(state.subsidiaries.entries()),
    finance: state.finance,
    population: state.population,
    quarterlyHistory: state.quarterlyHistory,
    gameTime: state.gameTime,
    speed: state.speed,
    lastDevelopmentDay: state.lastDevelopmentDay,
    lastLevelUpMonth: state.lastLevelUpMonth,
    lastAutoSaveDay: state.lastAutoSaveDay,
  };
  return JSON.stringify(data);
}

export function saveToLocalStorage(state: GameState): void {
  try {
    const json = serializeState(state);
    localStorage.setItem(SAVE_KEY, json);
  } catch {
    console.warn('Failed to save game');
  }
}

export function loadFromLocalStorage(): Partial<GameState> | null {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) return null;

    const data: SerializedState = JSON.parse(json);
    if (data.version !== 1) return null;

    return {
      map: data.map,
      tracks: new Map(data.tracks),
      stations: new Map(data.stations),
      trains: new Map(data.trains),
      buildings: new Map(data.buildings),
      subsidiaries: new Map(data.subsidiaries),
      finance: data.finance,
      population: data.population,
      quarterlyHistory: data.quarterlyHistory || [],
      gameTime: data.gameTime,
      speed: data.speed,
      lastDevelopmentDay: data.lastDevelopmentDay,
      lastLevelUpMonth: data.lastLevelUpMonth,
      lastAutoSaveDay: data.lastAutoSaveDay || 0,
    };
  } catch {
    console.warn('Failed to load game');
    return null;
  }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}
