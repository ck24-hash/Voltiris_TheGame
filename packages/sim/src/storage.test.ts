import { defaultContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import type { Storage, StoredLot } from './state';
import {
  freshness,
  lotQuality,
  removeSpoiled,
  sell,
  stockOf,
  storedUnits,
} from './storage';
import { deepFreeze } from './test-utils';

const { crops } = defaultContent;
const TOMATO_SHELF_HOURS = crops.tomato.shelfLifeDays * 24;

function lot(overrides: Partial<StoredLot> = {}): StoredLot {
  return {
    id: 'lot-1',
    cropId: 'tomato',
    units: 10,
    quality: 0.8,
    harvestedAtHour: 100,
    ...overrides,
  };
}

describe('freshness', () => {
  it('falls evenly from 1 at harvest to 0 at the end of the shelf life', () => {
    expect(freshness(lot(), 100, crops.tomato)).toBe(1);
    expect(
      freshness(lot(), 100 + TOMATO_SHELF_HOURS / 2, crops.tomato),
    ).toBeCloseTo(0.5, 12);
    expect(freshness(lot(), 100 + TOMATO_SHELF_HOURS, crops.tomato)).toBe(0);
    expect(freshness(lot(), 100 + 2 * TOMATO_SHELF_HOURS, crops.tomato)).toBe(
      0,
    );
  });

  it('lowers the quality a buyer pays for', () => {
    expect(
      lotQuality(lot(), 100 + TOMATO_SHELF_HOURS / 4, crops.tomato),
    ).toBeCloseTo(0.8 * 0.75, 12);
  });

  it('runs out faster for strawberries than for peppers', () => {
    const hour = 100 + 48;
    expect(
      freshness(lot({ cropId: 'strawberry' }), hour, crops.strawberry),
    ).toBeLessThan(freshness(lot({ cropId: 'pepper' }), hour, crops.pepper));
  });
});

describe('removeSpoiled', () => {
  const storage: Storage = {
    lots: [
      lot({ id: 'old', harvestedAtHour: 0 }),
      lot({ id: 'new', harvestedAtHour: 100 }),
    ],
  };

  it('drops harvests that are no longer fresh at all', () => {
    const after = removeSpoiled(storage, TOMATO_SHELF_HOURS, defaultContent);
    expect(after.lots.map((l) => l.id)).toEqual(['new']);
  });

  it('returns the same storage when nothing spoiled', () => {
    expect(removeSpoiled(storage, 50, defaultContent)).toBe(storage);
  });
});

describe('sell', () => {
  const storage: Storage = deepFreeze({
    lots: [
      lot({ id: 'a', units: 4, quality: 1, harvestedAtHour: 100 }),
      lot({ id: 'b', cropId: 'pepper', units: 3, harvestedAtHour: 100 }),
      lot({ id: 'c', units: 6, quality: 0.5, harvestedAtHour: 100 }),
    ],
  });

  it('counts the stock', () => {
    expect(storedUnits(storage)).toBe(13);
    expect(stockOf(storage, 'tomato')).toBe(10);
    expect(stockOf(storage, 'cucumber')).toBe(0);
  });

  it('sells the oldest harvests first, splitting the last one', () => {
    const sale = sell(storage, 'tomato', 6, 2, 100, crops.tomato);
    // 4 units at quality 1, then 2 at quality 0.5: 4×2 + 2×2×0.5 = 10.
    expect(sale.revenue).toBe(10);
    expect(sale.storage.lots).toEqual([
      storage.lots[1],
      { ...storage.lots[2], units: 4 },
    ]);
  });

  it('pays less for produce that has been stored a while', () => {
    const fresh = sell(storage, 'tomato', 4, 2, 100, crops.tomato).revenue;
    const later = sell(
      storage,
      'tomato',
      4,
      2,
      100 + TOMATO_SHELF_HOURS / 2,
      crops.tomato,
    ).revenue;
    expect(later).toBe(fresh / 2);
  });

  it('rounds the money once, to whole Volticoins', () => {
    const sale = sell(storage, 'tomato', 10, 1.37, 100, crops.tomato);
    expect(sale.revenue).toBe(Math.round(4 * 1.37 + 6 * 1.37 * 0.5));
    expect(sale.storage.lots).toEqual([storage.lots[1]]);
  });
});
