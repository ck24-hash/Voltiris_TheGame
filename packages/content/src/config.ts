import type {
  CareConfig,
  EconomyConfig,
  GrowthConfig,
  StorageConfig,
  TimeConfig,
} from './types';

// Starting values; balanced in Phase 11.

export const TIME: TimeConfig = {
  realMsPerTick: 15_000,
  daysPerSeason: 15,
  maxCatchUpMs: 24 * 60 * 60 * 1000,
};

export const ECONOMY: EconomyConfig = {
  startingMoney: 500,
  reserve: 20,
};

export const GROWTH: GrowthConfig = {
  stressQualityPenalty: 1,
};

export const CARE: CareConfig = {
  water: { amount: 10, cost: 2, max: 100 },
};

export const STORAGE: StorageConfig = {
  capacity: 150,
};
