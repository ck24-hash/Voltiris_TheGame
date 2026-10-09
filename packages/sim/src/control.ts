import type {
  ClimateVariable,
  CropDef,
  GameContent,
  SetpointId,
  Setpoints,
} from '@voltiris/content';
import type { Greenhouse } from './state';

/** The targets the equipment works to: the climate computer's, or the player's. */
export function controlSetpoints(
  greenhouse: Greenhouse,
  content: GameContent,
): Setpoints {
  return greenhouse.computer && greenhouse.auto
    ? autoSetpoints(greenhouse, content)
    : greenhouse.setpoints;
}

/** Share of the way into the crops' shared band where the computer aims. */
const MARGIN = 0.1;

/**
 * The climate computer's targets: just inside the band that suits every crop
 * growing (or the middle, where the crops disagree), the cheap side for the
 * air and the middle for water. With nothing growing, every
 * device idles.
 */
export function autoSetpoints(
  greenhouse: Greenhouse,
  content: GameContent,
): Setpoints {
  const { ranges, temperatureGap, humidityGap } = content.control;
  const crops = growingCrops(greenhouse, content);
  if (crops.length === 0) {
    return {
      heatTo: ranges.heatTo.min,
      ventAbove: ranges.ventAbove.max,
      humidityMax: ranges.humidityMax.max,
      humidityMin: ranges.humidityMin.min,
      co2: ranges.co2.min,
      light: ranges.light.min,
      water: ranges.water.min,
    };
  }

  const at = (variable: ClimateVariable, share: number) => {
    const { low, high } = sharedBand(crops, variable);
    return low + share * (high - low);
  };
  const heatTo = at('temperature', MARGIN);
  const humidityMin = at('humidity', MARGIN);
  const targets: Setpoints = {
    heatTo,
    ventAbove: Math.max(at('temperature', 1 - MARGIN), heatTo + temperatureGap),
    humidityMin,
    humidityMax: Math.max(
      at('humidity', 1 - MARGIN),
      humidityMin + humidityGap,
    ),
    co2: at('co2', MARGIN),
    light: at('light', MARGIN),
    water: at('water', 0.5),
  };
  const clamp = (id: SetpointId) =>
    Math.min(ranges[id].max, Math.max(ranges[id].min, targets[id]));
  return {
    heatTo: clamp('heatTo'),
    ventAbove: clamp('ventAbove'),
    humidityMax: clamp('humidityMax'),
    humidityMin: clamp('humidityMin'),
    co2: clamp('co2'),
    light: clamp('light'),
    water: clamp('water'),
  };
}

/** Where every crop's optimal band overlaps; the middle ground if they do not. */
function sharedBand(
  crops: readonly CropDef[],
  variable: ClimateVariable,
): { readonly low: number; readonly high: number } {
  const low = Math.max(...crops.map((c) => c.climate[variable].optimalLow));
  const high = Math.min(...crops.map((c) => c.climate[variable].optimalHigh));
  if (low <= high) return { low, high };
  const middle = (low + high) / 2;
  return { low: middle, high: middle };
}

function growingCrops(greenhouse: Greenhouse, content: GameContent): CropDef[] {
  const ids = new Set(
    greenhouse.plots.flatMap(({ planting }) =>
      planting?.status === 'growing' ? [planting.cropId] : [],
    ),
  );
  return [...ids].map((id) => content.crops[id]);
}
