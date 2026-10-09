import type { Books, DayBooks, GameState } from './state';
import { HOURS_PER_DAY } from './time';

// The game's books: what came in and went out, today and yesterday, so the
// player can see where the money goes.

export const EMPTY_DAY: DayBooks = {
  sales: 0,
  powerSold: 0,
  seeds: 0,
  water: 0,
  power: 0,
  fuel: 0,
  co2: 0,
  purchases: 0,
  solarKwh: 0,
  chpKwh: 0,
  boughtKwh: 0,
  soldKwh: 0,
};

export const NEW_BOOKS: Books = { today: EMPTY_DAY, yesterday: null };

/** Amounts to add to today's books. */
export type BookEntry = Partial<DayBooks>;

export function addToDay(day: DayBooks, entry: BookEntry): DayBooks {
  const next: Record<keyof DayBooks, number> = { ...day };
  for (const key of Object.keys(entry) as (keyof DayBooks)[]) {
    next[key] = day[key] + (entry[key] ?? 0);
  }
  return next;
}

/** The game with an entry added to today's books. */
export function record(state: GameState, entry: BookEntry): GameState {
  return {
    ...state,
    books: { ...state.books, today: addToDay(state.books.today, entry) },
  };
}

/**
 * The books after the hour that started at `gameHour`: at midnight, today
 * becomes yesterday and a new day starts.
 */
export function closeHour(books: Books, gameHour: number): Books {
  if ((gameHour + 1) % HOURS_PER_DAY !== 0) return books;
  return { today: EMPTY_DAY, yesterday: books.today };
}

export function income(day: DayBooks): number {
  return day.sales + day.powerSold;
}

/** What it cost to run the greenhouse: water, power, fuel and CO₂. */
export function runningCosts(day: DayBooks): number {
  return day.water + day.power + day.fuel + day.co2;
}

export function spending(day: DayBooks): number {
  return day.seeds + runningCosts(day) + day.purchases;
}

/** Money in less money out. */
export function profit(day: DayBooks): number {
  return income(day) - spending(day);
}
