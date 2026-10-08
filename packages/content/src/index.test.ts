import { describe, expect, it } from 'vitest';
import { CLIMATE_VARIABLES, CROP_IDS, SEASONS, defaultContent } from './index';

const { crops, startingGreenhouse, time, care, storage, market } =
  defaultContent;

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
    expect(Number.isInteger(startingGreenhouse.plots)).toBe(true);
    expect(startingGreenhouse.plots).toBeGreaterThan(0);
  });

  it.each(CROP_IDS)(
    'climate lets %s grow (every variable inside its limits)',
    (id) => {
      for (const variable of CLIMATE_VARIABLES) {
        const value = startingGreenhouse.climate[variable];
        const r = crops[id].climate[variable];
        expect(value, variable).toBeGreaterThan(r.limitLow);
        expect(value, variable).toBeLessThan(r.limitHigh);
      }
    },
  );
});

describe('economy', () => {
  it('lets a new player afford a full greenhouse of the dearest seeds', () => {
    const dearest = Math.max(...CROP_IDS.map((id) => crops[id].seedCost));
    expect(defaultContent.economy.startingMoney).toBeGreaterThanOrEqual(
      dearest * startingGreenhouse.plots,
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

  it('stores a full greenhouse of any crop', () => {
    for (const id of CROP_IDS) {
      expect(storage.capacity).toBeGreaterThanOrEqual(
        crops[id].yieldPerPlot * startingGreenhouse.plots,
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
