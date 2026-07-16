import type { Scenario } from './types.ts';

export const SCENARIOS: Scenario[] = [
  {
    id: 'mountain_village',
    name: '山間の街おこし',
    description: '山に囲まれた小さな村を鉄道で発展させましょう。人口5,000人を目指してください。',
    difficulty: 'easy',
    mapSeed: 101,
    initialCash: 5_000_000_000,
    objectives: [
      { id: 'pop1', description: '人口を5,000人にする', type: 'population', target: 5000, completed: false },
      { id: 'sta1', description: '駅を5つ建設する', type: 'stations', target: 5, completed: false },
    ],
    timeLimit: 30, // 30 years
  },
  {
    id: 'seaside_city',
    name: '海辺の都市計画',
    description: '海沿いの街に鉄道網を整備し、観光と産業の両立を目指しましょう。',
    difficulty: 'medium',
    mapSeed: 202,
    initialCash: 3_000_000_000,
    objectives: [
      { id: 'pop2', description: '人口を15,000人にする', type: 'population', target: 15000, completed: false },
      { id: 'inc2', description: '四半期収入1億円を達成', type: 'income', target: 100_000_000, completed: false },
      { id: 'trn2', description: '列車を10両運行する', type: 'trains', target: 10, completed: false },
    ],
    timeLimit: 25,
  },
  {
    id: 'megacity',
    name: 'メガシティへの挑戦',
    description: '広大な平原に巨大都市を建設せよ。資金は限られている。',
    difficulty: 'hard',
    mapSeed: 303,
    initialCash: 1_000_000_000,
    objectives: [
      { id: 'pop3', description: '人口を50,000人にする', type: 'population', target: 50000, completed: false },
      { id: 'cash3', description: '資金100億円を貯める', type: 'cash', target: 10_000_000_000, completed: false },
      { id: 'trk3', description: '線路を100本敷設する', type: 'tracks', target: 100, completed: false },
    ],
    timeLimit: 20,
  },
];

/**
 * Check scenario objectives against current game state.
 * Returns updated objectives with completion status.
 */
export function checkObjectives(
  scenario: Scenario,
  state: {
    population: number;
    finance: { cash: number; quarterlyIncome: { railFare: number; subsidiary: number; other: number; landRent: number; materialTransport: number } };
    stations: Map<unknown, unknown>;
    trains: Map<unknown, unknown>;
    tracks: Map<unknown, unknown>;
  },
  // 四半期決算の直後（quarterlyIncomeが0にリセットされた後）に呼ばれる場合、リセット前の
  // 確定収入をここで渡すことで「達成した瞬間にリセットされて判定漏れする」問題を避ける
  totalIncomeOverride?: number
): { objectives: Scenario['objectives']; allComplete: boolean } {
  const qi = state.finance.quarterlyIncome;
  const totalIncome = totalIncomeOverride ?? (qi.railFare + qi.subsidiary + qi.other + qi.landRent + qi.materialTransport);

  const objectives = scenario.objectives.map(obj => {
    let current = 0;
    switch (obj.type) {
      case 'population': current = state.population; break;
      case 'income': current = totalIncome; break;
      case 'stations': current = state.stations.size; break;
      case 'trains': current = state.trains.size; break;
      case 'tracks': current = state.tracks.size; break;
      case 'cash': current = state.finance.cash; break;
    }
    return { ...obj, completed: current >= obj.target };
  });

  return { objectives, allComplete: objectives.every(o => o.completed) };
}
