import type { CropDef, CropId, GameContent } from '@voltiris/content';
import {
  planHour,
  type ClimatePlan,
  type GameState,
  type Greenhouse,
} from '@voltiris/sim';

/**
 * What the first greenhouse's equipment does in the coming hour, and
 * whether it runs: everything stays off while the money does not cover the
 * hour.
 */
export function equipmentPlan(
  game: GameState,
  content: GameContent,
): { readonly plan: ClimatePlan; readonly running: boolean } {
  const hour = planHour(game, content);
  const plan = hour.plans[0];
  if (!plan) throw new Error('The game has no greenhouse');
  return { plan, running: hour.running };
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
