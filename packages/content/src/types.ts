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

export const CROP_IDS = ['cucumber', 'tomato', 'pepper'] as const;

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

export interface CropDef {
  readonly name: string;
  /** In-game days to maturity when every climate factor is 1. */
  readonly growthDays: number;
  /** Units harvested from one plot. */
  readonly yieldPerPlot: number;
  /** Base market price per unit. */
  readonly basePrice: number;
  readonly climate: Readonly<Record<ClimateVariable, ClimateResponse>>;
}

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

export type Season = (typeof SEASONS)[number];

export interface TimeConfig {
  /** Real milliseconds per tick (one in-game hour). */
  readonly realMsPerTick: number;
  /** In-game days per season; a year is four seasons. */
  readonly daysPerSeason: number;
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

export interface GameContent {
  readonly time: TimeConfig;
  readonly crops: Readonly<Record<CropId, CropDef>>;
  readonly startingGreenhouse: StartingGreenhouseConfig;
  readonly economy: EconomyConfig;
  readonly growth: GrowthConfig;
}
