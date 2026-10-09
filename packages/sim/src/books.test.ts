import { defaultContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import {
  addToDay,
  closeHour,
  EMPTY_DAY,
  income,
  NEW_BOOKS,
  profit,
  record,
  runningCosts,
  spending,
} from './books';
import type { DayBooks, GameState } from './state';
import {
  accept,
  buy,
  equipped,
  firstGreenhouse,
  newTestGame,
  plant,
  runTicks,
  withEnergy,
} from './test-utils';
import { HOURS_PER_DAY } from './time';

const content = defaultContent;

describe('addToDay', () => {
  it('adds each amount to its line, leaving the rest', () => {
    const day = addToDay(addToDay(EMPTY_DAY, { seeds: 6, water: 2 }), {
      seeds: 3,
      sales: 40,
    });
    expect(day).toEqual({ ...EMPTY_DAY, seeds: 9, water: 2, sales: 40 });
  });
});

describe('closeHour', () => {
  const busy = { today: { ...EMPTY_DAY, sales: 12 }, yesterday: null };

  it('keeps the day going until midnight', () => {
    expect(closeHour(busy, 22)).toBe(busy);
  });

  it('makes today yesterday at midnight, and starts a new day', () => {
    expect(closeHour(busy, 23)).toEqual({
      today: EMPTY_DAY,
      yesterday: busy.today,
    });
    expect(closeHour(busy, 23 + HOURS_PER_DAY * 4).yesterday).toBe(busy.today);
  });
});

describe('the totals', () => {
  const day: DayBooks = {
    ...EMPTY_DAY,
    sales: 100,
    powerSold: 5,
    seeds: 20,
    water: 4,
    power: 3,
    fuel: 2,
    co2: 1,
    purchases: 50,
  };

  it('add up money in, running costs, money out and profit', () => {
    expect(income(day)).toBe(105);
    expect(runningCosts(day)).toBe(10);
    expect(spending(day)).toBe(80);
    expect(profit(day)).toBe(25);
  });
});

describe('the game keeps its books', () => {
  it('starts with empty books', () => {
    expect(newTestGame().books).toEqual(NEW_BOOKS);
  });

  it('records purchases: equipment, upgrades, services and energy', () => {
    const rich = { ...newTestGame(), money: 10_000 };
    const heater = buy(rich, 'heater');
    const glass = accept(heater, {
      type: 'UpgradeGreenhouse',
      id: 'cmd-glass',
      issuedAt: 0,
      greenhouseId: firstGreenhouse(heater).id,
      upgrade: 'glass',
    });
    const solar = accept(glass, {
      type: 'BuyEnergy',
      id: 'cmd-solar',
      issuedAt: 0,
      asset: 'solar',
    });
    expect(solar.books.today.purchases).toBe(rich.money - solar.money);
  });

  it('records the running costs each hour, as they are paid', () => {
    const start = plant(equipped(['heater', 'co2', 'lights']), 'pepper');
    const after = runTicks(start, 10);
    const { today } = after.books;
    expect(today.fuel).toBeGreaterThan(0);
    expect(today.co2).toBeGreaterThan(0);
    expect(today.power).toBeGreaterThan(0);
    // Paid in whole coins, with the fraction owed.
    expect(start.money - after.money + after.owed).toBeCloseTo(
      runningCosts(today) - runningCosts(start.books.today),
      9,
    );
  });

  it('closes the day at midnight', () => {
    const state = withEnergy(newTestGame(), { solar: 1 });
    const day = runTicks(state, HOURS_PER_DAY);
    expect(day.books.today).toEqual(EMPTY_DAY);
    expect(day.books.yesterday?.solarKwh).toBeGreaterThan(0);
    const next = runTicks(day, 12);
    expect(next.books.yesterday).toEqual(day.books.yesterday);
    expect(next.books.today.solarKwh).toBeGreaterThan(0);
  });

  it('records without touching the money', () => {
    const state: GameState = newTestGame();
    const next = record(state, { sales: 10 });
    expect(next.money).toBe(state.money);
    expect(next.books.today.sales).toBe(10);
    expect(state.books.today.sales).toBe(0);
  });
});

describe('the reserve', () => {
  it('is enough for a round of the cheapest seeds', () => {
    const cheapest = Math.min(
      ...Object.values(content.crops).map((c) => c.seedCost),
    );
    const plots = firstGreenhouse(newTestGame()).plots.length;
    expect(content.economy.reserve).toBeGreaterThanOrEqual(plots * cheapest);
  });
});
