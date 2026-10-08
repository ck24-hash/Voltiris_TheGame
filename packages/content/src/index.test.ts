import { describe, expect, it } from 'vitest';
import { CLIMATE_VARIABLES, CROP_IDS, defaultContent } from './index';

const { crops, startingGreenhouse, time } = defaultContent;

describe('crops', () => {
  it('match the launch crop table in the build plan', () => {
    const table = CROP_IDS.map((id) => {
      const { growthDays, yieldPerPlot, basePrice } = crops[id];
      return { id, growthDays, yieldPerPlot, basePrice };
    });
    expect(table).toEqual([
      { id: 'cucumber', growthDays: 20, yieldPerPlot: 14, basePrice: 1.0 },
      { id: 'tomato', growthDays: 30, yieldPerPlot: 10, basePrice: 1.6 },
      { id: 'pepper', growthDays: 36, yieldPerPlot: 7, basePrice: 2.4 },
    ]);
  });

  it('define exactly the known crop ids', () => {
    expect(Object.keys(crops).sort()).toEqual([...CROP_IDS].sort());
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

describe('time', () => {
  it('runs one tick (one in-game hour) every 15 real seconds', () => {
    expect(time.realMsPerTick).toBe(15_000);
  });
});
