import { defaultContent, type GameContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { runningCosts } from './books';
import {
  hourPrices,
  initialEnergy,
  NO_DEMAND,
  runEnergy,
  sunshine,
  tariffBand,
  type EnergyDemand,
  type EnergyHour,
} from './energy';
import type { DayBooks, Energy, GameState } from './state';
import {
  accept,
  equipped,
  firstGreenhouse,
  newTestGame,
  plant,
  runTicks,
  withEnergy,
} from './test-utils';
import { planHour, tick } from './tick';
import { HOURS_PER_DAY } from './time';

const content = defaultContent;
const { solar, battery, chp } = content.energy;
const NOON = 12;
const NIGHT = 2;
const PEAK = 18;

/** Runs a game from midnight through one whole day; its books. */
function oneDay(state: GameState): DayBooks {
  expect(state.clock.gameHour % HOURS_PER_DAY).toBe(0);
  const day = runTicks(state, HOURS_PER_DAY).books.yesterday;
  if (!day) throw new Error('expected a finished day');
  return day;
}

/** Each hour of the energy system through one day. */
function energyHours(state: GameState): EnergyHour[] {
  const hours: EnergyHour[] = [];
  let next = state;
  for (let k = 0; k < HOURS_PER_DAY; k++) {
    hours.push(planHour(next, content).energy);
    next = tick(next, content);
  }
  return hours;
}

/** Power bought, less power sold. */
function powerBill(day: DayBooks): number {
  return day.power - day.powerSold;
}

function energyBill(day: DayBooks): number {
  return powerBill(day) + day.fuel + day.co2;
}

/** A pepper growing, so the equipment works (it rests while nothing grows). */
function growing(state: GameState): GameState {
  return plant(state, 'pepper');
}

// Phase 7 "Done when": a player can cut their power bill by adding solar and
// a battery, and a CHP unit lowers heating and CO₂ costs.
describe('the power bill', () => {
  // LED lights and a heat pump: about 2 kW, day and night.
  const electric = growing(
    equipped(['lights', 'lights', 'heater', 'heater', 'heater'], {
      light: 700,
    }),
  );

  // The second day, once the battery has settled into its daily round.
  const secondDay = (state: GameState) =>
    oneDay(runTicks(state, HOURS_PER_DAY));

  it('goes down with solar panels, and further with a battery', () => {
    const gridOnly = secondDay(electric);
    const withSolar = secondDay(withEnergy(electric, { solar: 2 }));
    const withBattery = secondDay(
      withEnergy(electric, { solar: 2, battery: 1 }),
    );

    expect(powerBill(gridOnly)).toBeGreaterThan(0);
    expect(withSolar.solarKwh).toBeGreaterThan(0);
    expect(powerBill(withSolar)).toBeLessThan(powerBill(gridOnly) * 0.8);
    // The battery keeps midday's spare solar for the dear evening, instead
    // of selling it at half price.
    expect(withBattery.soldKwh).toBeLessThan(withSolar.soldKwh);
    expect(powerBill(withBattery)).toBeLessThan(powerBill(withSolar));
  });

  it('goes down with a battery alone, filled at night for the evening peak', () => {
    const gridOnly = secondDay(electric);
    const withBattery = secondDay(withEnergy(electric, { battery: 1 }));
    expect(powerBill(withBattery)).toBeLessThan(powerBill(gridOnly));
  });

  describe('with a CHP unit', () => {
    // A large greenhouse kept warm by a gas heater, fed CO₂ and lit.
    const big = (() => {
      let state = equipped(['heater', 'co2', 'lights'], { light: 550 });
      for (let size = 2; size <= 3; size++) {
        state = accept(state, {
          type: 'UpgradeGreenhouse',
          id: `cmd-size-${size}`,
          issuedAt: 0,
          greenhouseId: firstGreenhouse(state).id,
          upgrade: 'size',
        });
      }
      return growing(state);
    })();

    it('pays less for heating and CO₂, and less overall', () => {
      const heating = (state: GameState) =>
        energyHours(state).reduce((sum, h) => sum + h.costs.heating, 0);
      const without = oneDay(big);
      const withChp = oneDay(withEnergy(big, { chp: 1 }));
      expect(withChp.chpKwh).toBeGreaterThan(0);
      expect(heating(withEnergy(big, { chp: 1 }))).toBeLessThan(
        heating(big) * 0.5,
      );
      expect(withChp.co2).toBeLessThan(without.co2);
      expect(energyBill(withChp)).toBeLessThan(energyBill(without));
    });
  });
});

describe('hourPrices', () => {
  it('follows the tariff through the day, cheapest at night', () => {
    const at = (hour: number) => hourPrices(hour, content);
    expect(at(NIGHT)).toMatchObject({ band: 'Night', offPeak: true });
    expect(at(NOON)).toMatchObject({ band: 'Day', offPeak: false });
    expect(at(PEAK)).toMatchObject({ band: 'Peak', offPeak: false });
    expect(at(23)).toMatchObject({ band: 'Night', offPeak: true });
    expect(at(NIGHT).buy).toBeLessThan(at(NOON).buy);
    expect(at(NOON).buy).toBeLessThan(at(PEAK).buy);
  });

  it('pays half for spare power', () => {
    const prices = hourPrices(NOON, content);
    expect(prices.sell).toBeCloseTo(
      prices.buy * content.energy.grid.sellShare,
      12,
    );
  });

  it('changes with the seasons', () => {
    // The middle of each season falls at midday.
    const seasonHours = content.time.daysPerSeason * HOURS_PER_DAY;
    const middleOf = (season: number) => season * seasonHours + seasonHours / 2;
    expect(middleOf(0) % HOURS_PER_DAY).toBe(NOON);
    const { seasonal } = content.energy.grid;
    const day = tariffBand(NOON, content).price;
    expect(hourPrices(middleOf(0), content).buy).toBeCloseTo(
      day * seasonal.spring,
      12,
    );
    expect(hourPrices(middleOf(3), content).buy).toBeCloseTo(
      day * seasonal.winter,
      12,
    );
  });
});

describe('sunshine', () => {
  it('is 0 at night and peaks at midday', () => {
    expect(sunshine(NIGHT, content)).toBe(0);
    expect(sunshine(22, content)).toBe(0);
    expect(sunshine(NOON, content)).toBeGreaterThan(0.95);
    expect(sunshine(NOON, content)).toBeLessThanOrEqual(1);
    // The same in the morning as in the afternoon.
    expect(sunshine(8, content)).toBeCloseTo(sunshine(17, content), 12);
    expect(sunshine(8, content)).toBeLessThan(sunshine(10, content));
  });

  it('repeats every day', () => {
    expect(sunshine(NOON + 24 * 7, content)).toBe(sunshine(NOON, content));
  });
});

describe('runEnergy', () => {
  const none = initialEnergy();
  const demand = (power: number): EnergyDemand => ({ ...NO_DEMAND, power });
  const run = (
    energy: Energy,
    need: EnergyDemand,
    hour: number,
    using: GameContent = content,
  ) => runEnergy(energy, need, hour, using);

  it('buys everything from the grid without own power', () => {
    const hour = run(none, demand(3), NOON);
    expect(hour).toMatchObject({ bought: 3, sold: 0, solar: 0, chp: 0 });
    expect(hour.costs.power).toBeCloseTo(3 * hour.prices.buy, 12);
    expect(hour.total).toBe(hour.costs.power);
  });

  it('uses solar power first and sells what is spare', () => {
    const panels = { ...none, solar: 2 };
    const hour = run(panels, demand(1), NOON);
    const made = (solar[1]?.peak ?? 0) * sunshine(NOON, content);
    expect(hour.solar).toBeCloseTo(made, 12);
    expect(hour.bought).toBe(0);
    expect(hour.sold).toBeCloseTo(made - 1, 12);
    expect(hour.costs.power).toBe(0);
    expect(hour.costs.powerSold).toBeCloseTo((made - 1) * hour.prices.sell, 12);
    expect(hour.total).toBeCloseTo(-(made - 1) * hour.prices.sell, 12);
    // No sun at night.
    expect(run(panels, demand(1), NIGHT)).toMatchObject({
      solar: 0,
      bought: 1,
    });
  });

  it('fills the battery with spare power before selling any, losing a little', () => {
    const level = battery[0];
    if (!level) throw new Error('expected a battery');
    const hour = run({ ...none, solar: 3, battery: 1 }, demand(0), NOON);
    expect(hour.charged).toBe(level.rate);
    expect(hour.stored).toBeCloseTo(level.rate * level.efficiency, 12);
    expect(hour.sold).toBeCloseTo(hour.solar - level.rate, 12);
  });

  it('never fills the battery past its capacity', () => {
    const level = battery[0];
    if (!level) throw new Error('expected a battery');
    const almostFull = {
      ...none,
      solar: 3,
      battery: 1,
      stored: level.capacity - 1,
    };
    const hour = run(almostFull, demand(0), NOON);
    expect(hour.stored).toBeCloseTo(level.capacity, 12);
    expect(hour.charged).toBeCloseTo(1 / level.efficiency, 12);
  });

  it('draws on the battery when power runs short, outside the night tariff', () => {
    const charged = { ...none, battery: 1, stored: 6 };
    const evening = run(charged, demand(2.5), PEAK);
    expect(evening).toMatchObject({ discharged: 2.5, bought: 0, stored: 3.5 });
    // Not faster than its rate.
    const rate = battery[0]?.rate ?? 0;
    const greedy = run(charged, demand(10), PEAK);
    expect(greedy.discharged).toBe(rate);
    expect(greedy.bought).toBe(10 - rate);
  });

  it('keeps its charge at night and fills up from the cheap grid instead', () => {
    const level = battery[0];
    if (!level) throw new Error('expected a battery');
    const night = run({ ...none, battery: 1, stored: 2 }, demand(1), NIGHT);
    expect(night.discharged).toBe(0);
    expect(night.charged).toBe(level.rate);
    expect(night.bought).toBe(1 + level.rate);
    expect(night.stored).toBeCloseTo(2 + level.rate * level.efficiency, 12);

    // With solar panels, it leaves room for tomorrow's spare sun.
    const sunny = run(
      { ...none, solar: 2, battery: 1, stored: 2 },
      demand(1),
      NIGHT,
    );
    expect(sunny.charged).toBe(0);

    // When the player cannot pay, it only takes spare power.
    const broke = runEnergy(
      { ...none, battery: 1 },
      NO_DEMAND,
      NIGHT,
      content,
      {
        gridCharging: false,
      },
    );
    expect(broke).toMatchObject({ charged: 0, bought: 0, total: 0 });
  });

  describe('a CHP unit', () => {
    const unit = chp[0];
    if (!unit) throw new Error('expected a CHP');
    const withChp = { ...none, chp: 1 };
    // A gas heater, an injector and some lamps, at midday.
    const busy: EnergyDemand = {
      power: 3,
      heat: [{ kwh: 4, fuel: 'gas', efficiency: 0.85 }],
      co2: [{ units: 2000, costPer1000: 0.06 }],
    };

    it('gives heat to the heaters, CO₂ to the injectors and power to the lamps', () => {
      const hour = run(withChp, busy, NOON);
      expect(hour.chp).toBe(unit.power);
      expect(hour.chpHeat).toBe(4);
      expect(hour.chpCo2).toBe(unit.co2);
      expect(hour.costs.heating).toBe(0);
      expect(hour.costs.co2).toBeCloseTo(((2000 - unit.co2) * 0.06) / 1000, 12);
      expect(hour.sold).toBeCloseTo(unit.power - 3, 12);
      expect(hour.costs.chpFuel).toBeCloseTo(
        unit.input * content.energy.prices.gas,
        12,
      );
      expect(hour.total).toBeLessThan(run(none, busy, NOON).total);
    });

    it('spares a heat pump power', () => {
      const pump: EnergyDemand = {
        power: 2,
        heat: [{ kwh: 4, fuel: 'power', efficiency: 4 }],
        co2: [],
      };
      const hour = runEnergy(withChp, pump, PEAK, content);
      // The heat pump's 1 kW is not needed: the CHP's heat does its job.
      expect(hour.demand).toBeCloseTo(1, 12);
    });

    it('stays off when it would not save money', () => {
      expect(run(withChp, NO_DEMAND, NIGHT)).toMatchObject({
        chp: 0,
        costs: { chpFuel: 0 },
      });
    });
  });
});

describe('the books', () => {
  it('keep the energy as the game runs, and the bill is paid', () => {
    const state = growing(
      withEnergy(equipped(['lights'], { light: 600 }), { solar: 1 }),
    );
    const day = oneDay(state);
    const after = runTicks(state, HOURS_PER_DAY);
    const hours = energyHours(state);
    expect(day.solarKwh).toBeCloseTo(
      hours.reduce((sum, h) => sum + h.solar, 0),
      9,
    );
    expect(day.boughtKwh).toBeGreaterThan(0);
    // Money paid for the day: the running costs less the power sold, in
    // whole coins, with the fraction still owed.
    expect(state.money - after.money + after.owed).toBeCloseTo(
      runningCosts(day) - day.powerSold,
      9,
    );
  });

  it('pay the player for spare solar power', () => {
    const sunny = withEnergy(newTestGame(), { solar: 3 });
    const after = runTicks(sunny, HOURS_PER_DAY);
    expect(after.books.yesterday?.soldKwh).toBeGreaterThan(0);
    expect(after.books.yesterday?.powerSold).toBeGreaterThan(0);
    expect(after.money).toBeGreaterThan(sunny.money);
  });
});
