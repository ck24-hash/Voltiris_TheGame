import {
  CLIMATE_VARIABLES,
  type Climate,
  type ClimateResponse,
  type CropDef,
  type GrowthConfig,
} from '@voltiris/content';
import type { GrowingPlanting, Planting } from './state';
import { HOURS_PER_DAY } from './time';

/** 1 inside the optimal band, falling linearly to 0 at the limits. */
export function climateFactor(value: number, r: ClimateResponse): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= r.limitLow || value >= r.limitHigh) return 0;
  if (value < r.optimalLow) {
    return (value - r.limitLow) / (r.optimalLow - r.limitLow);
  }
  if (value > r.optimalHigh) {
    return (r.limitHigh - value) / (r.limitHigh - r.optimalHigh);
  }
  return 1;
}

/**
 * Growth multiplier for one tick: the weighted geometric mean of the six
 * climate factors. Exactly 1 when every variable is in its optimal band, and 0
 * as soon as any variable reaches its limit.
 */
export function growthRate(climate: Climate, crop: CropDef): number {
  let weightedLogSum = 0;
  let weightSum = 0;
  for (const variable of CLIMATE_VARIABLES) {
    const response = crop.climate[variable];
    const factor = climateFactor(climate[variable], response);
    if (factor === 0) return 0;
    weightedLogSum += response.growthWeight * Math.log(factor);
    weightSum += response.growthWeight;
  }
  return Math.exp(weightedLogSum / weightSum);
}

/**
 * Stress added in one tick. Every variable outside its optimal band adds
 * (1 - factor) times the crop's sensitivity on that side of the band.
 */
export function stressRate(climate: Climate, crop: CropDef): number {
  let stress = 0;
  for (const variable of CLIMATE_VARIABLES) {
    const response = crop.climate[variable];
    const value = climate[variable];
    const factor = climateFactor(value, response);
    if (factor >= 1) continue;
    const sensitivity =
      value < response.optimalLow ? response.stressBelow : response.stressAbove;
    stress += sensitivity * (1 - factor);
  }
  return stress;
}

/** Final quality in (0, 1]: 1 with no stress, lower as average stress rises. */
export function cropQuality(
  totalStress: number,
  hoursGrown: number,
  config: GrowthConfig,
): number {
  const averageStress = hoursGrown > 0 ? totalStress / hoursGrown : 0;
  return 1 / (1 + config.stressQualityPenalty * averageStress);
}

export function requiredGrowthHours(crop: CropDef): number {
  return crop.growthDays * HOURS_PER_DAY;
}

/** Growth progress from 0 to 1. */
export function growthProgress(planting: Planting, crop: CropDef): number {
  return Math.min(1, planting.growthHours / requiredGrowthHours(crop));
}

/**
 * Estimated ticks until ready if the climate stays as it is; Infinity if
 * growth has stopped. For display: it can be one tick off, because the sim
 * sums growth tick by tick in floating point.
 */
export function hoursToReady(
  planting: GrowingPlanting,
  climate: Climate,
  crop: CropDef,
): number {
  const rate = growthRate(climate, crop);
  if (rate === 0) return Infinity;
  const remaining = requiredGrowthHours(crop) - planting.growthHours;
  return Math.max(0, Math.ceil(remaining / rate));
}

/** Grows a planting by one tick; `gameHour` is the hour the tick ends on. */
export function growPlanting(
  planting: GrowingPlanting,
  climate: Climate,
  crop: CropDef,
  gameHour: number,
  config: GrowthConfig,
): Planting {
  const growthHours = planting.growthHours + growthRate(climate, crop);
  const stress = planting.stress + stressRate(climate, crop);

  if (growthHours < requiredGrowthHours(crop)) {
    return { ...planting, growthHours, stress };
  }

  return {
    ...planting,
    status: 'ready',
    growthHours,
    stress,
    readyAtHour: gameHour,
    quality: cropQuality(stress, gameHour - planting.plantedAtHour, config),
    yieldUnits: crop.yieldPerPlot,
  };
}
