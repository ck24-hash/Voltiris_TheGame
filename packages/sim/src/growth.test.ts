import {
  CROP_IDS,
  defaultContent,
  type ClimateResponse,
} from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import {
  climateFactor,
  cropQuality,
  growthProgress,
  growthRate,
  hoursToReady,
  requiredGrowthHours,
  stressRate,
} from './growth';
import { optimalClimate } from './test-utils';

const { crops, growth } = defaultContent;

const band: ClimateResponse = {
  limitLow: 10,
  optimalLow: 20,
  optimalHigh: 30,
  limitHigh: 40,
  growthWeight: 1,
  stressBelow: 1,
  stressAbove: 1,
};

describe('climateFactor', () => {
  it('is 1 across the optimal band, edges included', () => {
    expect(climateFactor(20, band)).toBe(1);
    expect(climateFactor(25, band)).toBe(1);
    expect(climateFactor(30, band)).toBe(1);
  });

  it('falls linearly to 0 at the limits on both sides', () => {
    expect(climateFactor(15, band)).toBe(0.5);
    expect(climateFactor(35, band)).toBe(0.5);
    expect(climateFactor(12.5, band)).toBe(0.25);
    expect(climateFactor(10, band)).toBe(0);
    expect(climateFactor(40, band)).toBe(0);
  });

  it('is 0 beyond the limits and for non-finite values', () => {
    expect(climateFactor(-5, band)).toBe(0);
    expect(climateFactor(99, band)).toBe(0);
    expect(climateFactor(Number.NaN, band)).toBe(0);
    expect(climateFactor(Infinity, band)).toBe(0);
  });
});

describe('growthRate', () => {
  it.each(CROP_IDS)('is exactly 1 for %s in optimal climate', (id) => {
    expect(growthRate(optimalClimate(id), crops[id])).toBe(1);
  });

  it('is the weighted geometric mean of the factors', () => {
    const tomato = crops.tomato;
    const climate = { ...optimalClimate('tomato'), temperature: 14 }; // factor 0.5
    const totalWeight = Object.values(tomato.climate).reduce(
      (sum, r) => sum + r.growthWeight,
      0,
    );
    const expected =
      0.5 ** (tomato.climate.temperature.growthWeight / totalWeight);
    expect(growthRate(climate, tomato)).toBeCloseTo(expected, 12);
  });

  it('is 0 when any variable reaches its limit', () => {
    const climate = { ...optimalClimate('tomato'), water: 20 };
    expect(growthRate(climate, crops.tomato)).toBe(0);
  });

  it('punishes a shortfall more on heavily weighted variables', () => {
    // Tomato: light weight 1.5, humidity weight 0.5. Put each at factor 0.5.
    const optimal = optimalClimate('tomato');
    const lowLight = growthRate({ ...optimal, light: 275 }, crops.tomato);
    const lowHumidity = growthRate({ ...optimal, humidity: 50 }, crops.tomato);
    expect(lowLight).toBeLessThan(lowHumidity);
  });
});

describe('stressRate', () => {
  it.each(CROP_IDS)('is 0 for %s in optimal climate', (id) => {
    expect(stressRate(optimalClimate(id), crops[id])).toBe(0);
  });

  it('uses the crop sensitivity on the side of the band it is on', () => {
    // Cucumber temperature: limits 12/38, optimal 22–28, stressBelow 2, stressAbove 0.75.
    const optimal = optimalClimate('cucumber');
    expect(stressRate({ ...optimal, temperature: 17 }, crops.cucumber)).toBe(1);
    expect(stressRate({ ...optimal, temperature: 33 }, crops.cucumber)).toBe(
      0.375,
    );
  });

  it('adds up stress from several variables', () => {
    const optimal = optimalClimate('cucumber');
    const cold = stressRate({ ...optimal, temperature: 17 }, crops.cucumber);
    const dry = stressRate({ ...optimal, water: 45 }, crops.cucumber);
    const both = stressRate(
      { ...optimal, temperature: 17, water: 45 },
      crops.cucumber,
    );
    expect(both).toBeCloseTo(cold + dry, 12);
  });
});

describe('cropQuality', () => {
  it('is 1 with no stress', () => {
    expect(cropQuality(0, 720, growth)).toBe(1);
    expect(cropQuality(0, 0, growth)).toBe(1);
  });

  it('is 1 / (1 + penalty × average stress per hour)', () => {
    expect(cropQuality(720, 720, { stressQualityPenalty: 1 })).toBe(0.5);
    expect(cropQuality(360, 720, { stressQualityPenalty: 2 })).toBe(0.5);
  });

  it('falls as stress rises but stays above 0', () => {
    const qualities = [0, 100, 500, 5000].map((s) =>
      cropQuality(s, 720, growth),
    );
    for (let i = 1; i < qualities.length; i++) {
      expect(qualities[i]).toBeLessThan(qualities[i - 1] ?? Infinity);
      expect(qualities[i]).toBeGreaterThan(0);
    }
  });
});

describe('growthProgress', () => {
  it('goes from 0 to 1 and never above', () => {
    const planting = {
      status: 'growing',
      cropId: 'tomato',
      plantedAtHour: 0,
      growthHours: 0,
      stress: 0,
    } as const;
    expect(growthProgress(planting, crops.tomato)).toBe(0);
    expect(
      growthProgress({ ...planting, growthHours: 360 }, crops.tomato),
    ).toBe(0.5);
    expect(
      growthProgress({ ...planting, growthHours: 900 }, crops.tomato),
    ).toBe(1);
  });
});

describe('hoursToReady', () => {
  const planting = {
    status: 'growing',
    cropId: 'tomato',
    plantedAtHour: 0,
    growthHours: 120,
    stress: 0,
  } as const;

  it('is the remaining hours in optimal climate', () => {
    expect(hoursToReady(planting, optimalClimate('tomato'), crops.tomato)).toBe(
      600,
    );
  });

  it('accounts for slower growth in a worse climate', () => {
    const cold = { ...optimalClimate('tomato'), temperature: 14 };
    const rate = growthRate(cold, crops.tomato);
    expect(hoursToReady(planting, cold, crops.tomato)).toBe(
      Math.ceil(600 / rate),
    );
  });

  it('is Infinity when growth has stopped', () => {
    const frozen = { ...optimalClimate('tomato'), temperature: 10 };
    expect(hoursToReady(planting, frozen, crops.tomato)).toBe(Infinity);
  });
});

describe('requiredGrowthHours', () => {
  it('converts growth days to ticks (hours)', () => {
    expect(requiredGrowthHours(crops.tomato)).toBe(720);
    expect(requiredGrowthHours(crops.cucumber)).toBe(480);
    expect(requiredGrowthHours(crops.pepper)).toBe(864);
  });
});
