import type { ClimateVariable, CropDef } from '@voltiris/content';
import { climateFactor } from '@voltiris/sim';

export interface GaugeDef {
  readonly label: string;
  /** Fits the compact gauge chips. */
  readonly short: string;
  readonly unit: string;
  readonly decimals: number;
  /** Plain-language status below and above the crops' optimal band. */
  readonly low: string;
  readonly high: string;
}

export const GAUGES: Record<ClimateVariable, GaugeDef> = {
  temperature: {
    label: 'Temperature',
    short: 'Temp',
    unit: '°C',
    decimals: 1,
    low: 'Too cold',
    high: 'Too hot',
  },
  humidity: {
    label: 'Humidity',
    short: 'Humidity',
    unit: '%',
    decimals: 0,
    low: 'Too dry',
    high: 'Too humid',
  },
  co2: {
    label: 'CO₂',
    short: 'CO₂',
    unit: 'ppm',
    decimals: 0,
    low: 'Low',
    high: 'High',
  },
  light: {
    label: 'Light',
    short: 'Light',
    unit: 'PAR',
    decimals: 0,
    low: 'Too dark',
    high: 'Too bright',
  },
  water: {
    label: 'Water',
    short: 'Water',
    unit: '%',
    decimals: 0,
    low: 'Thirsty',
    high: 'Waterlogged',
  },
  nutrients: {
    label: 'Nutrients',
    short: 'Nutrients',
    unit: 'EC',
    decimals: 1,
    low: 'Hungry',
    high: 'Too salty',
  },
};

/** idle: nothing growing. good: optimal for every crop. warn: slows growth. bad: stops growth. */
type GaugeStatus = 'idle' | 'good' | 'warn' | 'bad';

export interface GaugeReading {
  readonly status: GaugeStatus;
  readonly note: string;
}

/**
 * How a climate value suits the crops currently growing, judged by the
 * worst-off crop. The value is judged as shown (rounded to the gauge's
 * precision), so a gauge never reads "22.0 °C, too cold" for a crop that
 * wants 22 °C.
 */
export function readGauge(
  variable: ClimateVariable,
  value: number,
  growingCrops: readonly CropDef[],
): GaugeReading {
  const gauge = GAUGES[variable];
  const shown = Number(value.toFixed(gauge.decimals));
  let worst: { crop: CropDef; factor: number } | null = null;
  for (const crop of growingCrops) {
    const factor = climateFactor(shown, crop.climate[variable]);
    if (!worst || factor < worst.factor) worst = { crop, factor };
  }

  if (!worst) return { status: 'idle', note: 'No crops' };
  if (worst.factor >= 1) return { status: 'good', note: 'Good' };

  const tooLow = shown < worst.crop.climate[variable].optimalLow;
  return {
    status: worst.factor === 0 ? 'bad' : 'warn',
    note: tooLow ? gauge.low : gauge.high,
  };
}
