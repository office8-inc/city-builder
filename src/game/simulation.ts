import type { GameTime, Finance, GameState } from './types.ts';
import { MINUTES_PER_HOUR, HOURS_PER_DAY, DAYS_PER_MONTH, MONTHS_PER_YEAR, TRAIN_TYPES, getPassengerMultiplier } from './constants.ts';
import { calculatePopulation } from './cityDevelopment.ts';

// Advance game time by a given number of minutes
export function advanceTime(time: GameTime, minutes: number): GameTime {
  let { year, month, day, hour, minute } = time;

  minute += minutes;

  while (minute >= MINUTES_PER_HOUR) {
    minute -= MINUTES_PER_HOUR;
    hour++;
  }

  while (hour >= HOURS_PER_DAY) {
    hour -= HOURS_PER_DAY;
    day++;
  }

  while (day > DAYS_PER_MONTH) {
    day -= DAYS_PER_MONTH;
    month++;
  }

  while (month > MONTHS_PER_YEAR) {
    month -= MONTHS_PER_YEAR;
    year++;
  }

  return { year, month, day, hour, minute };
}

export function formatGameTime(time: GameTime): string {
  const y = time.year;
  const m = String(time.month).padStart(2, '0');
  const d = String(time.day).padStart(2, '0');
  const h = String(time.hour).padStart(2, '0');
  const min = String(time.minute).padStart(2, '0');
  return `${y}/${m}/${d} ${h}:${min}`;
}

export function formatDate(time: GameTime): string {
  const y = time.year;
  const m = String(time.month).padStart(2, '0');
  const d = String(time.day).padStart(2, '0');
  return `${y}年${m}月${d}日`;
}

export function formatClock(time: GameTime): string {
  const h = String(time.hour).padStart(2, '0');
  const min = String(time.minute).padStart(2, '0');
  return `${h}:${min}`;
}

/** Calculate daily income and expense, update finance in-place. Returns updated finance. */
export function calculateDailyFinance(state: GameState, buildings: Map<string, import('./types.ts').Building>): Finance {
  const finance = { ...state.finance };

  // Rush hour multiplier
  const rushMultiplier = getPassengerMultiplier(state.gameTime.hour);

  // Income: Rail fare (passengers x distance x ¥200 per train, with rush hour and fare premium)
  let dailyFare = 0;
  for (const train of state.trains.values()) {
    const ttype = TRAIN_TYPES[train.type];
    dailyFare += train.passengers * state.stations.size * 200 * rushMultiplier * ttype.farePremium;
  }

  // Income: Subsidiary revenue (monthly / 30)
  let dailySubRevenue = 0;
  for (const sub of state.subsidiaries.values()) {
    dailySubRevenue += sub.monthlyRevenue / 30;
  }

  // Income: Tax (population x ¥100/month / 30)
  const pop = calculatePopulation(buildings);
  const dailyTax = (pop * 100) / 30;

  // Income: Land rent
  let dailyLandRent = 0;
  if (state.ownedLand.size > 0) {
    for (const key of state.ownedLand) {
      const [xs, zs] = key.split(',');
      const x = parseInt(xs), z = parseInt(zs);
      const tile = state.map[x]?.[z];
      if (tile && tile.buildingId) {
        dailyLandRent += Math.max(1, tile.landValue) * 500;
      }
    }
    dailyLandRent /= 30;
  }

  // Expenses: Track maintenance (¥10,000 per segment per day)
  const dailyTrackMaint = state.tracks.size * 10_000;

  // Expenses: Train maintenance (type maintenance / 30 per day)
  let dailyTrainMaint = 0;
  for (const train of state.trains.values()) {
    const ttype = TRAIN_TYPES[train.type];
    dailyTrainMaint += ttype.maintenance / 30;
  }

  // Expenses: Staff cost ((stations*5 + trains*3) x ¥50,000/month / 30)
  const staffHeadcount = state.stations.size * 5 + state.trains.size * 3;
  const dailyStaffCost = (staffHeadcount * 50_000) / 30;

  // Expenses: Subsidiary running cost (monthly / 30)
  let dailySubExpense = 0;
  for (const sub of state.subsidiaries.values()) {
    dailySubExpense += sub.monthlyExpense / 30;
  }

  // Expenses: Interest (debt x rate annual / 365)
  const dailyInterest = (finance.debt * 0.03) / 365;

  const totalDailyIncome = dailyFare + dailySubRevenue + dailyTax + dailyLandRent;
  const totalDailyExpenses = dailyTrackMaint + dailyTrainMaint + dailyStaffCost + dailySubExpense + dailyInterest;

  finance.cash += Math.round(totalDailyIncome - totalDailyExpenses);
  finance.quarterlyIncome = {
    railFare: finance.quarterlyIncome.railFare + Math.round(dailyFare),
    subsidiary: finance.quarterlyIncome.subsidiary + Math.round(dailySubRevenue),
    other: finance.quarterlyIncome.other + Math.round(dailyTax),
    landRent: finance.quarterlyIncome.landRent + Math.round(dailyLandRent),
  };
  finance.quarterlyExpenses = {
    trackMaintenance: finance.quarterlyExpenses.trackMaintenance + Math.round(dailyTrackMaint),
    trainMaintenance: finance.quarterlyExpenses.trainMaintenance + Math.round(dailyTrainMaint),
    staffCost: finance.quarterlyExpenses.staffCost + Math.round(dailyStaffCost),
    subsidiaryRunning: finance.quarterlyExpenses.subsidiaryRunning + Math.round(dailySubExpense),
    interestPayment: finance.quarterlyExpenses.interestPayment + Math.round(dailyInterest),
  };

  return finance;
}
