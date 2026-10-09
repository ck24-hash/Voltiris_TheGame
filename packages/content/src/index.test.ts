import { describe, expect, it } from 'vitest';
import {
  AIR_VARIABLES,
  CLIMATE_VARIABLES,
  CROP_IDS,
  ENERGY_ASSETS,
  EQUIPMENT_KINDS,
  EQUIPMENT_SETPOINTS,
  SEASONS,
  SETPOINT_IDS,
  defaultContent,
} from './index';

const {
  crops,
  greenhouse,
  time,
  care,
  storage,
  market,
  equipment,
  control,
  physics,
} = defaultContent;
const startingPlots = greenhouse.sizes[0]?.plots ?? 0;

describe('crops', () => {
  it('define exactly the known crop ids', () => {
    expect(Object.keys(crops).sort()).toEqual([...CROP_IDS].sort());
  });

  it('are listed from the quickest to the slowest', () => {
    const hours = CROP_IDS.map((id) => crops[id].growthHours);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
  });

  it.each(CROP_IDS)('%s has sensible amounts', (id) => {
    const crop = crops[id];
    expect(Number.isInteger(crop.growthHours)).toBe(true);
    expect(Number.isInteger(crop.yieldPerPlot)).toBe(true);
    expect(Number.isInteger(crop.seedCost)).toBe(true);
    for (const value of [
      crop.growthHours,
      crop.yieldPerPlot,
      crop.seedCost,
      crop.basePrice,
      crop.waterUse,
      crop.nutrientUse,
      crop.shelfLifeDays,
    ]) {
      expect(value).toBeGreaterThan(0);
    }
    for (const season of SEASONS) {
      expect(crop.seasonalPrice[season]).toBeGreaterThan(0);
    }
  });

  describe.each(CROP_IDS)('%s climate responses', (id) => {
    it.each(CLIMATE_VARIABLES)('%s band is well-formed', (variable) => {
      const r = crops[id].climate[variable];
      expect(r.limitLow).toBeLessThan(r.optimalLow);
      expect(r.optimalLow).toBeLessThanOrEqual(r.optimalHigh);
      expect(r.optimalHigh).toBeLessThan(r.limitHigh);
      expect(r.growthWeight).toBeGreaterThan(0);
      expect(r.stressBelow).toBeGreaterThanOrEqual(0);
      expect(r.stressAbove).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('starting greenhouse', () => {
  it('has a positive whole number of plots', () => {
    expect(Number.isInteger(startingPlots)).toBe(true);
    expect(startingPlots).toBeGreaterThan(0);
  });

  it.each(CROP_IDS)(
    'climate lets %s grow (every variable inside its limits)',
    (id) => {
      for (const variable of CLIMATE_VARIABLES) {
        const value = greenhouse.startingClimate[variable];
        const r = crops[id].climate[variable];
        expect(value, variable).toBeGreaterThan(r.limitLow);
        expect(value, variable).toBeLessThan(r.limitHigh);
      }
    },
  );
});

describe('greenhouse upgrades', () => {
  it.each([
    ['glass', greenhouse.glass],
    ['sizes', greenhouse.sizes],
  ] as const)(
    '%s start free at level 1, then cost more each level',
    (_, levels) => {
      expect(levels[0]?.price).toBe(0);
      for (let k = 1; k < levels.length; k++) {
        expect(Number.isInteger(levels[k]?.price)).toBe(true);
        expect(levels[k]?.price).toBeGreaterThan(levels[k - 1]?.price ?? 0);
      }
    },
  );

  it('glass lets light through and keeps some heat in', () => {
    for (const glass of greenhouse.glass) {
      expect(glass.transmission).toBeGreaterThan(0);
      expect(glass.transmission).toBeLessThanOrEqual(1);
      expect(glass.heatLoss).toBeGreaterThan(0);
      expect(glass.airChanges).toBeGreaterThan(0);
    }
  });

  it('sizes add whole rows of two plots', () => {
    for (let k = 0; k < greenhouse.sizes.length; k++) {
      const plots = greenhouse.sizes[k]?.plots ?? 0;
      expect(plots % 2).toBe(0);
      if (k > 0) {
        expect(plots).toBeGreaterThan(greenhouse.sizes[k - 1]?.plots ?? 0);
      }
    }
  });
});

describe('equipment', () => {
  it.each(EQUIPMENT_KINDS)(
    '%s has levels that cost whole coins, dearer each level',
    (kind) => {
      const levels = equipment.levels[kind];
      expect(levels.length).toBeGreaterThan(0);
      let previous = 0;
      for (const level of levels) {
        expect(Number.isInteger(level.price)).toBe(true);
        expect(level.price).toBeGreaterThan(previous);
        expect(level.wearRate).toBeGreaterThan(0);
        expect(level.wearRate).toBeLessThan(1);
        previous = level.price;
      }
    },
  );

  it('loses part of its output when worn, never all of it', () => {
    expect(equipment.wearLoss).toBeGreaterThan(0);
    expect(equipment.wearLoss).toBeLessThan(1);
    expect(equipment.serviceShare).toBeGreaterThan(0);
  });

  it('burns gas in the first heaters, and the heat pump runs on power', () => {
    const fuels = equipment.levels.heater.map((level) => level.fuel);
    expect(fuels).toEqual(['gas', 'gas', 'power']);
    const pump = equipment.levels.heater[2];
    expect(pump?.efficiency).toBeGreaterThan(1);
    expect(pump?.exhaustCo2).toBe(0);
  });
});

describe('energy', () => {
  const { grid, sun, prices } = defaultContent.energy;

  it('has a tariff from midnight, band after band through the day', () => {
    expect(grid.tariff[0]?.from).toBe(0);
    for (let k = 1; k < grid.tariff.length; k++) {
      expect(grid.tariff[k]?.from).toBeGreaterThan(
        grid.tariff[k - 1]?.from ?? 0,
      );
    }
    expect(grid.tariff.at(-1)?.from).toBeLessThan(24);
    for (const band of grid.tariff) expect(band.price).toBeGreaterThan(0);
    for (const season of SEASONS) {
      expect(grid.seasonal[season]).toBeGreaterThan(0);
    }
  });

  it('pays less for spare power than it charges', () => {
    expect(grid.sellShare).toBeGreaterThan(0);
    expect(grid.sellShare).toBeLessThan(1);
  });

  it('has the sun up for part of the day', () => {
    expect(sun.rise).toBeGreaterThan(0);
    expect(sun.set).toBeGreaterThan(sun.rise);
    expect(sun.set).toBeLessThan(24);
    expect(prices.gas).toBeGreaterThan(0);
    expect(prices.biogas).toBeGreaterThan(0);
  });

  it.each(ENERGY_ASSETS)(
    '%s levels cost whole coins, dearer each level',
    (asset) => {
      const levels = defaultContent.energy[asset];
      expect(levels.length).toBeGreaterThan(0);
      let previous = 0;
      for (const level of levels) {
        expect(Number.isInteger(level.price)).toBe(true);
        expect(level.price).toBeGreaterThan(previous);
        previous = level.price;
      }
    },
  );

  it('loses a little in the battery, and turns most CHP fuel into power and heat', () => {
    for (const battery of defaultContent.energy.battery) {
      expect(battery.efficiency).toBeGreaterThan(0);
      expect(battery.efficiency).toBeLessThan(1);
      expect(battery.rate).toBeLessThanOrEqual(battery.capacity);
    }
    for (const chp of defaultContent.energy.chp) {
      expect(chp.power + chp.heat).toBeLessThan(chp.input);
    }
  });
});

describe('climate control', () => {
  it('works to setpoints that every piece of equipment covers', () => {
    const covered = EQUIPMENT_KINDS.flatMap(
      (kind) => EQUIPMENT_SETPOINTS[kind],
    );
    expect([...covered].sort()).toEqual([...SETPOINT_IDS].sort());
  });

  it.each(SETPOINT_IDS)('starts %s inside its range', (id) => {
    const range = control.ranges[id];
    expect(range.min).toBeLessThan(range.max);
    expect(range.step).toBeGreaterThan(0);
    expect(control.initial[id]).toBeGreaterThanOrEqual(range.min);
    expect(control.initial[id]).toBeLessThanOrEqual(range.max);
  });

  it('keeps heating below venting, and fogging below venting', () => {
    const { initial, ranges, temperatureGap, humidityGap } = control;
    expect(initial.ventAbove - initial.heatTo).toBeGreaterThanOrEqual(
      temperatureGap,
    );
    expect(initial.humidityMax - initial.humidityMin).toBeGreaterThanOrEqual(
      humidityGap,
    );
    // Moving one setpoint pushes its partner, which must stay in range.
    expect(ranges.heatTo.max + temperatureGap).toBeLessThanOrEqual(
      ranges.ventAbove.max,
    );
    expect(ranges.ventAbove.min - temperatureGap).toBeGreaterThanOrEqual(
      ranges.heatTo.min,
    );
    expect(ranges.humidityMin.max + humidityGap).toBeLessThanOrEqual(
      ranges.humidityMax.max,
    );
    expect(ranges.humidityMax.min - humidityGap).toBeGreaterThanOrEqual(
      ranges.humidityMin.min,
    );
  });

  it('moves the air part of the way to its balance each hour', () => {
    for (const variable of AIR_VARIABLES) {
      expect(physics.settle[variable]).toBeGreaterThan(0);
      expect(physics.settle[variable]).toBeLessThanOrEqual(1);
    }
  });
});

describe('economy', () => {
  it('lets a new player afford a full greenhouse of the dearest seeds', () => {
    const dearest = Math.max(...CROP_IDS.map((id) => crops[id].seedCost));
    expect(defaultContent.economy.startingMoney).toBeGreaterThanOrEqual(
      dearest * startingPlots,
    );
  });

  it.each(['water', 'nutrients'] as const)(
    'tops up %s in whole coins, within reach of every crop band',
    (resource) => {
      const topUp = care[resource];
      expect(Number.isInteger(topUp.cost)).toBe(true);
      expect(topUp.amount).toBeGreaterThan(0);
      for (const id of CROP_IDS) {
        const band = crops[id].climate[resource];
        expect(topUp.max).toBeGreaterThan(band.optimalHigh);
        // One top-up never jumps right over a crop's optimal band.
        expect(topUp.amount).toBeLessThan(band.optimalHigh - band.optimalLow);
      }
    },
  );

  it('stores a full greenhouse of any crop, at the largest size', () => {
    const largest = greenhouse.sizes.at(-1)?.plots ?? 0;
    for (const id of CROP_IDS) {
      expect(storage.capacity).toBeGreaterThanOrEqual(
        crops[id].yieldPerPlot * largest,
      );
    }
  });

  it('keeps market swings around 1', () => {
    expect(market.minSwing).toBeGreaterThan(0);
    expect(market.minSwing).toBeLessThan(1);
    expect(market.maxSwing).toBeGreaterThan(1);
    expect(market.reversion).toBeGreaterThan(0);
    expect(market.reversion).toBeLessThan(1);
    expect(market.volatility).toBeGreaterThan(0);
  });
});

describe('time', () => {
  it('runs one tick (one in-game hour) every 15 real seconds', () => {
    expect(time.realMsPerTick).toBe(15_000);
  });

  it('has 15 in-game days per season', () => {
    expect(time.daysPerSeason).toBe(15);
  });

  it('catches up at most 24 real hours after a break', () => {
    expect(time.maxCatchUpMs).toBe(24 * 60 * 60 * 1000);
    expect(time.maxCatchUpMs % time.realMsPerTick).toBe(0);
  });
});
