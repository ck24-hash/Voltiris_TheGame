import type { CropDef, CropId } from '@voltiris/content';
import type { Greenhouse } from '@voltiris/sim';

/** Distinct crops that are still growing in a greenhouse. */
export function growingCrops(
  greenhouse: Greenhouse,
  crops: Readonly<Record<CropId, CropDef>>,
): CropDef[] {
  const ids = new Set<CropId>();
  for (const plot of greenhouse.plots) {
    if (plot.planting?.status === 'growing') ids.add(plot.planting.cropId);
  }
  return [...ids].map((id) => crops[id]);
}

/** The greenhouse resources the player tops up by hand. */
export const CARE = ['water', 'nutrients'] as const;
export type Care = (typeof CARE)[number];

export function isCare(variable: string): variable is Care {
  return (CARE as readonly string[]).includes(variable);
}

export const CROP_ICONS: Record<CropId, string> = {
  microgreens: '🌱',
  cucumber: '🥒',
  strawberry: '🍓',
  tomato: '🍅',
  pepper: '🫑',
};
