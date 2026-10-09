import { defaultContent, type CropId } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { applyCommand, type Command, type PlantCropCommand } from './commands';
import { cropPrice } from './market';
import type { GameState } from './state';
import { lotQuality } from './storage';
import {
  accept,
  deepFreeze,
  firstGreenhouse,
  harvest,
  newTestGame,
  optimalClimate,
  plant,
  plantingAt,
  runTicks,
  STILL_AIR,
  withClimate,
} from './test-utils';

const { crops } = defaultContent;

function plantCommand(
  state: GameState,
  overrides: Partial<PlantCropCommand> = {},
): PlantCropCommand {
  const greenhouse = firstGreenhouse(state);
  return {
    type: 'PlantCrop',
    id: 'cmd-1',
    issuedAt: 0,
    greenhouseId: greenhouse.id,
    plotId: greenhouse.plots[0]?.id ?? '',
    cropId: 'tomato',
    ...overrides,
  };
}

describe('PlantCrop', () => {
  it('plants a growing crop at the current game hour', () => {
    const state = runTicks(newTestGame(), 5);
    const result = applyCommand(state, plantCommand(state), defaultContent);
    if (!result.ok) throw new Error(result.error.message);
    expect(plantingAt(result.state)).toEqual({
      status: 'growing',
      cropId: 'tomato',
      plantedAtHour: 5,
      growthHours: 0,
      stress: 0,
    });
  });

  it('only changes the chosen plot', () => {
    const state = newTestGame();
    const planted = plant(state, 'pepper', 2);
    const before = firstGreenhouse(state).plots;
    const after = firstGreenhouse(planted).plots;
    expect(after[2]?.planting?.cropId).toBe('pepper');
    expect([after[0], after[1], after[3]]).toEqual([
      before[0],
      before[1],
      before[3],
    ]);
  });

  it.each([
    ['UNKNOWN_CROP', { cropId: 'banana' as CropId }],
    ['UNKNOWN_CROP', { cropId: 'toString' as CropId }],
    ['GREENHOUSE_NOT_FOUND', { greenhouseId: 'nope' }],
    ['PLOT_NOT_FOUND', { plotId: 'nope' }],
  ] as const)('rejects with %s', (code, overrides) => {
    const state = newTestGame();
    const result = applyCommand(
      state,
      plantCommand(state, overrides),
      defaultContent,
    );
    expect(result).toMatchObject({ ok: false, error: { code } });
  });

  it('rejects planting into an occupied plot', () => {
    const state = plant(newTestGame(), 'tomato');
    const result = applyCommand(
      state,
      plantCommand(state, { cropId: 'cucumber' }),
      defaultContent,
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'PLOT_OCCUPIED' },
    });
  });

  it('rejects a command of unknown type instead of crashing', () => {
    const state = newTestGame();
    const bogus = { type: 'Teleport', id: 'x', issuedAt: 0 } as unknown;
    const result = applyCommand(state, bogus as Command, defaultContent);
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_COMMAND' },
    });
  });

  it('never mutates the input state', () => {
    const state = deepFreeze(newTestGame());
    expect(() =>
      applyCommand(state, plantCommand(state), defaultContent),
    ).not.toThrow();
  });

  it('pays for the seeds, kept in the books', () => {
    const state = newTestGame();
    const planted = plant(state, 'pepper');
    expect(planted.money).toBe(state.money - crops.pepper.seedCost);
    expect(planted.books.today.seeds).toBe(crops.pepper.seedCost);
  });

  it('refuses seeds the player cannot afford', () => {
    const state = { ...newTestGame(), money: crops.tomato.seedCost - 1 };
    const result = applyCommand(state, plantCommand(state), defaultContent);
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'NOT_ENOUGH_MONEY' },
    });
  });
});

describe('Water', () => {
  const { amount, cost, max } = defaultContent.care.water;

  function command(state: GameState, greenhouseId?: string): Command {
    return {
      type: 'Water',
      id: 'cmd-1',
      issuedAt: 0,
      greenhouseId: greenhouseId ?? firstGreenhouse(state).id,
    };
  }

  function level(state: GameState): number {
    return firstGreenhouse(state).climate.water;
  }

  it('raises the greenhouse water for a small fee, kept in the books', () => {
    const state = newTestGame();
    const next = accept(state, command(state));
    expect(level(next)).toBeCloseTo(level(state) + amount, 12);
    expect(next.money).toBe(state.money - cost);
    expect(next.books.today.water).toBe(cost);
  });

  it('never raises water above its maximum', () => {
    const state = withClimate(newTestGame(), { water: max - amount / 2 });
    expect(level(accept(state, command(state)))).toBe(max);
  });

  it.each([
    ['ALREADY_FULL', (s: GameState) => withClimate(s, { water: max })],
    ['NOT_ENOUGH_MONEY', (s: GameState) => ({ ...s, money: cost - 1 })],
  ] as const)('rejects with %s', (code, edit) => {
    const state = edit(newTestGame());
    expect(applyCommand(state, command(state), defaultContent)).toMatchObject({
      ok: false,
      error: { code },
    });
  });

  it('rejects an unknown greenhouse', () => {
    const state = newTestGame();
    expect(
      applyCommand(state, command(state, 'nope'), defaultContent),
    ).toMatchObject({ ok: false, error: { code: 'GREENHOUSE_NOT_FOUND' } });
  });
});

describe('HarvestCrop', () => {
  /** A ready cucumber in plot 0, picked at hour 30. */
  function readyCucumber(): GameState {
    const game = withClimate(newTestGame(), optimalClimate('cucumber'));
    return runTicks(plant(game, 'cucumber'), 30, STILL_AIR);
  }

  function harvestCommand(state: GameState, plotIndex = 0): Command {
    const greenhouse = firstGreenhouse(state);
    return {
      type: 'HarvestCrop',
      id: 'cmd-1',
      issuedAt: 0,
      greenhouseId: greenhouse.id,
      plotId: greenhouse.plots[plotIndex]?.id ?? '',
    };
  }

  it('moves a ready crop into storage and empties the plot', () => {
    const state = readyCucumber();
    const ready = plantingAt(state);
    if (ready?.status !== 'ready') throw new Error('expected a ready crop');

    const next = harvest(state);
    expect(plantingAt(next)).toBeNull();
    expect(next.storage.lots).toEqual([
      {
        id: expect.any(String) as string,
        cropId: 'cucumber',
        units: ready.yieldUnits,
        quality: ready.quality,
        harvestedAtHour: 30,
      },
    ]);
    expect(next.money).toBe(state.money);
  });

  it('gives each harvest its own id from the seeded rng', () => {
    let state = readyCucumber();
    state = harvest(state);
    state = runTicks(plant(state, 'cucumber'), 30, STILL_AIR);
    const twice = harvest(state);
    const [first, second] = twice.storage.lots;
    expect(first?.id).not.toBe(second?.id);
    expect(twice.rng).not.toEqual(state.rng);
  });

  it.each([
    ['PLOT_EMPTY', 1],
    ['PLOT_NOT_FOUND', 9],
  ] as const)('rejects with %s', (code, plotIndex) => {
    const state = readyCucumber();
    expect(
      applyCommand(state, harvestCommand(state, plotIndex), defaultContent),
    ).toMatchObject({ ok: false, error: { code } });
  });

  it('rejects a crop that is still growing', () => {
    const state = plant(newTestGame(), 'pepper');
    expect(
      applyCommand(state, harvestCommand(state), defaultContent),
    ).toMatchObject({ ok: false, error: { code: 'NOT_READY' } });
  });

  it('rejects a harvest that does not fit in storage', () => {
    const state = readyCucumber();
    const room = crops.cucumber.yieldPerPlot - 1;
    const full: GameState = {
      ...state,
      storage: {
        lots: [
          {
            id: 'lot-full',
            cropId: 'pepper',
            units: defaultContent.storage.capacity - room,
            quality: 1,
            harvestedAtHour: 30,
          },
        ],
      },
    };
    expect(
      applyCommand(full, harvestCommand(full), defaultContent),
    ).toMatchObject({ ok: false, error: { code: 'STORAGE_FULL' } });
  });
});

describe('SellCrop', () => {
  /** 12 cucumbers in storage, harvested at hour 30. */
  function stocked(): GameState {
    const game = withClimate(newTestGame(), optimalClimate('cucumber'));
    return harvest(runTicks(plant(game, 'cucumber'), 30, STILL_AIR));
  }

  function sellCommand(cropId: CropId, units: number): Command {
    return { type: 'SellCrop', id: 'cmd-1', issuedAt: 0, cropId, units };
  }

  it("sells at the crop's price, for the produce's quality and freshness", () => {
    const state = runTicks(stocked(), 10);
    const [lot] = state.storage.lots;
    if (!lot) throw new Error('expected a harvest in storage');
    const price = cropPrice('cucumber', defaultContent);
    const quality = lotQuality(lot, state.clock.gameHour, crops.cucumber);

    const next = accept(state, sellCommand('cucumber', 5));
    const revenue = Math.round(5 * price * quality);
    expect(next.money).toBe(state.money + revenue);
    expect(next.books.today.sales).toBe(state.books.today.sales + revenue);
    expect(next.storage.lots).toEqual([{ ...lot, units: lot.units - 5 }]);
  });

  it('pays a fixed price: the same at any hour of the year', () => {
    expect(cropPrice('cucumber', defaultContent)).toBe(crops.cucumber.price);
    const fresh = (hour: number) =>
      withClimate(
        { ...newTestGame(), clock: { gameHour: hour, lastTickAt: 0 } },
        optimalClimate('cucumber'),
      );
    const sold = [0, 2000, 5000].map((hour) => {
      const state = harvest(
        runTicks(plant(fresh(hour), 'cucumber'), 30, STILL_AIR),
      );
      return accept(state, sellCommand('cucumber', 5)).money - state.money;
    });
    expect(new Set(sold).size).toBe(1);
  });

  it.each([
    ['INVALID_AMOUNT', 'cucumber', 0],
    ['INVALID_AMOUNT', 'cucumber', 1.5],
    ['NOT_ENOUGH_STOCK', 'cucumber', crops.cucumber.yieldPerPlot + 1],
    ['NOT_ENOUGH_STOCK', 'tomato', 1],
    ['UNKNOWN_CROP', 'banana', 1],
  ] as const)('rejects with %s (%s × %d)', (code, cropId, units) => {
    const state = stocked();
    expect(
      applyCommand(state, sellCommand(cropId as CropId, units), defaultContent),
    ).toMatchObject({ ok: false, error: { code } });
  });
});

describe('every command', () => {
  it('leaves the input state untouched', () => {
    const game = withClimate(newTestGame(), optimalClimate('cucumber'));
    const ready = deepFreeze(runTicks(plant(game, 'cucumber'), 30, STILL_AIR));
    const stored = deepFreeze(
      harvest(runTicks(plant(game, 'cucumber'), 30, STILL_AIR)),
    );
    const greenhouseId = firstGreenhouse(ready).id;
    const plotId = firstGreenhouse(ready).plots[0]?.id ?? '';
    const meta = { id: 'cmd-1', issuedAt: 0 };
    expect(() => {
      accept(ready, { ...meta, type: 'Water', greenhouseId });
      accept(ready, { ...meta, type: 'HarvestCrop', greenhouseId, plotId });
      accept(stored, {
        ...meta,
        type: 'SellCrop',
        cropId: 'cucumber',
        units: 1,
      });
    }).not.toThrow();
  });
});
