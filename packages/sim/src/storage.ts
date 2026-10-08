import type { CropDef, CropId, GameContent } from '@voltiris/content';
import type { Storage, StoredLot } from './state';
import { HOURS_PER_DAY } from './time';

/** 1 at harvest, falling evenly to 0 at the end of the crop's shelf life. */
export function freshness(
  lot: StoredLot,
  gameHour: number,
  crop: CropDef,
): number {
  const age = gameHour - lot.harvestedAtHour;
  return Math.max(0, 1 - age / (crop.shelfLifeDays * HOURS_PER_DAY));
}

/** What a buyer pays for: the quality it grew with, times its freshness. */
export function lotQuality(
  lot: StoredLot,
  gameHour: number,
  crop: CropDef,
): number {
  return lot.quality * freshness(lot, gameHour, crop);
}

export function storedUnits(storage: Storage): number {
  return storage.lots.reduce((sum, lot) => sum + lot.units, 0);
}

export function stockOf(storage: Storage, cropId: CropId): number {
  return storage.lots.reduce(
    (sum, lot) => (lot.cropId === cropId ? sum + lot.units : sum),
    0,
  );
}

/** Throws away harvests that are no longer fresh at all. */
export function removeSpoiled(
  storage: Storage,
  gameHour: number,
  content: GameContent,
): Storage {
  const lots = storage.lots.filter(
    (lot) => freshness(lot, gameHour, content.crops[lot.cropId]) > 0,
  );
  return lots.length === storage.lots.length ? storage : { ...storage, lots };
}

export interface Sale {
  /** Whole Volticoins. */
  readonly revenue: number;
  readonly storage: Storage;
}

/**
 * Sells `units` of a crop at `price` per unit of full quality, oldest
 * harvests first (they spoil first). The caller checks the stock.
 */
export function sell(
  storage: Storage,
  cropId: CropId,
  units: number,
  price: number,
  gameHour: number,
  crop: CropDef,
): Sale {
  let left = units;
  let value = 0;
  const lots: StoredLot[] = [];
  for (const lot of storage.lots) {
    if (lot.cropId !== cropId || left === 0) {
      lots.push(lot);
      continue;
    }
    const sold = Math.min(left, lot.units);
    value += sold * price * lotQuality(lot, gameHour, crop);
    left -= sold;
    if (sold < lot.units) lots.push({ ...lot, units: lot.units - sold });
  }
  return { revenue: Math.round(value), storage: { ...storage, lots } };
}
