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

export const CROP_ICONS: Record<CropId, string> = {
  cucumber: '🥒',
  tomato: '🍅',
  pepper: '🫑',
};
