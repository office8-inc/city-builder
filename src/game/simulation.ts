import type { GameTime } from './types.ts';
import { MINUTES_PER_HOUR, HOURS_PER_DAY, DAYS_PER_MONTH, MONTHS_PER_YEAR } from './constants.ts';

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
