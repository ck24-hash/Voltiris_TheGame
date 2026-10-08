export const CLIMATE_VARIABLES = [
  'temperature',
  'humidity',
  'co2',
  'light',
  'water',
  'nutrients',
] as const;

export type ClimateVariable = (typeof CLIMATE_VARIABLES)[number];

/**
 * Greenhouse climate. Units: temperature °C, humidity % RH, co2 ppm,
 * light PAR µmol/m²/s, water substrate moisture %, nutrients EC mS/cm.
 */
export type Climate = Readonly<Record<ClimateVariable, number>>;

/** From the quickest crop to the slowest. */
export const CROP_IDS = [
  'microgreens',
  'cucumber',
  'strawberry',
  'tomato',
  'pepper',
] as const;

export type CropId = (typeof CROP_IDS)[number];

/**
 * How a crop responds to one climate variable. The growth factor is 1 between
 * optimalLow and optimalHigh and falls linearly to 0 at limitLow and limitHigh.
 */
export interface ClimateResponse {
  readonly limitLow: number;
  readonly optimalLow: number;
  readonly optimalHigh: number;
  readonly limitHigh: number;
  /** Weight of this variable in the growth geometric mean. */
  readonly growthWeight: number;
  /** Stress per tick at factor 0 when the value is below the optimal band. */
  readonly stressBelow: number;
  /** Stress per tick at factor 0 when the value is above the optimal band. */
  readonly stressAbove: number;
}

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

export type Season = (typeof SEASONS)[number];

export interface CropDef {
  readonly name: string;
  /** In-game hours (ticks) to maturity when every climate factor is 1. */
  readonly growthHours: number;
  /** Units harvested from one plot. */
  readonly yieldPerPlot: number;
  /** Price of the seeds (or young plants) for one plot. */
  readonly seedCost: number;
  /** Market price per unit at full quality, before seasons and swings. */
  readonly basePrice: number;
  /** Price multiplier at the middle of each season; it changes gradually in between. */
  readonly seasonalPrice: Readonly<Record<Season, number>>;
  /** Water one plot uses per hour of growth, in moisture % points. */
  readonly waterUse: number;
  /** Nutrients one plot uses per hour of growth, in EC (mS/cm). */
  readonly nutrientUse: number;
  /** In-game days the harvest keeps in storage: freshness falls to 0 over this time. */
  readonly shelfLifeDays: number;
  readonly climate: Readonly<Record<ClimateVariable, ClimateResponse>>;
}

export interface TimeConfig {
  /** Real milliseconds per tick (one in-game hour). */
  readonly realMsPerTick: number;
  /** In-game days per season; a year is four seasons. */
  readonly daysPerSeason: number;
  /**
   * Longest stretch of real time simulated after a break (app closed or
   * asleep). Anything beyond it is skipped.
   */
  readonly maxCatchUpMs: number;
}

export interface StartingGreenhouseConfig {
  readonly plots: number;
  readonly climate: Climate;
}

export interface EconomyConfig {
  readonly startingMoney: number;
}

export interface GrowthConfig {
  /** How strongly average stress per hour lowers final quality. */
  readonly stressQualityPenalty: number;
}

/** Topping up one greenhouse resource (water or nutrients) by hand. */
export interface TopUpConfig {
  /** Added per top-up: moisture % points for water, EC for nutrients. */
  readonly amount: number;
  readonly cost: number;
  /** Nothing is added beyond this. */
  readonly max: number;
}

export interface CareConfig {
  readonly water: TopUpConfig;
  readonly nutrients: TopUpConfig;
}

export interface StorageConfig {
  /** Units of produce the storage holds. */
  readonly capacity: number;
}

/**
 * Market prices: each crop's price is its base price × the season's
 * multiplier × a swing factor that wanders a little every tick.
 */
export interface MarketConfig {
  /** Share of the way back to a swing of 1 each tick. */
  readonly reversion: number;
  /** Largest random change of the swing in one tick. */
  readonly volatility: number;
  readonly minSwing: number;
  readonly maxSwing: number;
}

export interface GameContent {
  readonly time: TimeConfig;
  readonly crops: Readonly<Record<CropId, CropDef>>;
  readonly startingGreenhouse: StartingGreenhouseConfig;
  readonly economy: EconomyConfig;
  readonly growth: GrowthConfig;
  readonly care: CareConfig;
  readonly storage: StorageConfig;
  readonly market: MarketConfig;
}
