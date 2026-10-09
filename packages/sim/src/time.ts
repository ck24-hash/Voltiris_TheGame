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

/**
 * A value that changes with the seasons, at a game hour. Each season's value
 * holds at its middle; in between, it moves in a straight line towards the
 * next season's. Uses only + − × ÷, so every device gets the same value.
 */
export function seasonalValue(
  values: Readonly<Record<Season, number>>,
  gameHour: number,
  time: TimeConfig,
): number {
  const seasonHours = time.daysPerSeason * HOURS_PER_DAY;
  const yearHours = seasonHours * SEASONS.length;
  // Seasons since the middle of spring, within one year: from -0.5 to 3.5.
  const t = (gameHour % yearHours) / seasonHours - 0.5;
  const from = Math.floor(t);
  const a = values[seasonAt(from)];
  const b = values[seasonAt(from + 1)];
  return a + (b - a) * (t - from);
}

function seasonAt(index: number): Season {
  const season = SEASONS[(index + SEASONS.length) % SEASONS.length];
  if (!season) throw new RangeError(`No season at ${index}`);
  return season;
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
