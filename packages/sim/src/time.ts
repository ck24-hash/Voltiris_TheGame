import { SEASONS, type Season, type TimeConfig } from '@voltiris/content';

/** One tick is one in-game hour. */
export const HOURS_PER_DAY = 24;

/** Whole ticks that have come due between `lastTickAt` and `nowMs`. */
export function ticksDue(
  lastTickAt: number,
  nowMs: number,
  realMsPerTick: number,
): number {
  if (nowMs <= lastTickAt) return 0;
  return Math.floor((nowMs - lastTickAt) / realMsPerTick);
}

export interface Calendar {
  /** 1-based. */
  readonly year: number;
  readonly season: Season;
  /** 1-based day within the season. */
  readonly dayOfSeason: number;
  /** 1-based day since the game started. */
  readonly day: number;
  /** 0–23. */
  readonly hour: number;
}

/** The game starts at 00:00 on day 1 of spring, year 1. */
export function getCalendar(gameHour: number, time: TimeConfig): Calendar {
  const dayIndex = Math.floor(gameHour / HOURS_PER_DAY);
  const seasonIndex = Math.floor(dayIndex / time.daysPerSeason);
  const season = SEASONS[seasonIndex % SEASONS.length];
  if (!season) throw new RangeError(`Invalid game hour ${gameHour}`);
  return {
    year: Math.floor(seasonIndex / SEASONS.length) + 1,
    season,
    dayOfSeason: (dayIndex % time.daysPerSeason) + 1,
    day: dayIndex + 1,
    hour: gameHour % HOURS_PER_DAY,
  };
}
