import type {
  CareConfig,
  EconomyConfig,
  GrowthConfig,
  MarketConfig,
  StartingGreenhouseConfig,
  StorageConfig,
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

export const CARE: CareConfig = {
  water: { amount: 10, cost: 2, max: 100 },
  nutrients: { amount: 0.3, cost: 3, max: 6 },
};

export const STORAGE: StorageConfig = {
  capacity: 150,
};

// Swings of about ±10% around the seasonal price, settling within minutes.
export const MARKET: MarketConfig = {
  reversion: 0.02,
  volatility: 0.03,
  minSwing: 0.6,
  maxSwing: 1.6,
};
