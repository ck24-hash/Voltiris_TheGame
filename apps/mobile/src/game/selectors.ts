import type { CropDef, CropId, GameContent } from '@voltiris/content';
import {
  greenhousePlan,
  type ClimatePlan,
  type GameState,
  type Greenhouse,
} from '@voltiris/sim';

/**
 * What a greenhouse's equipment does in the coming hour, and whether it
 * runs: it stays off while the player's money does not cover its costs.
 */
export function equipmentPlan(
  game: GameState,
  greenhouse: Greenhouse,
  content: GameContent,
): { readonly plan: ClimatePlan; readonly running: boolean } {
  const plan = greenhousePlan(greenhouse, content);
  return { plan, running: game.owed + plan.cost <= game.money };
}

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
