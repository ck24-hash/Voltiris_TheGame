import type {
  EconomyConfig,
  GrowthConfig,
  StartingGreenhouseConfig,
  TimeConfig,
} from './types';

// Starting values; balanced in Phase 11.

export const TIME: TimeConfig = {
  realMsPerTick: 15_000,
  daysPerSeason: 15,
  maxCatchUpMs: 24 * 60 * 60 * 1000,
};

export const STARTING_GREENHOUSE: StartingGreenhouseConfig = {
  plots: 4,
  climate: {
    temperature: 20,
    humidity: 70,
    co2: 420,
    light: 400,
    water: 65,
    nutrients: 2.5,
  },
};

export const ECONOMY: EconomyConfig = {
  startingMoney: 500,
};

export const GROWTH: GrowthConfig = {
  stressQualityPenalty: 1,
};
