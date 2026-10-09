import type { CropId, GameContent } from '@voltiris/content';

/** What one unit sells for at full quality and freshness: a fixed price. */
export function cropPrice(cropId: CropId, content: GameContent): number {
  return content.crops[cropId].price;
}
