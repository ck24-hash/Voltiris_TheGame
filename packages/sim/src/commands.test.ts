import { defaultContent, type CropId } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { applyCommand, type PlantCropCommand } from './commands';
import type { GameState } from './state';
import {
  deepFreeze,
  firstGreenhouse,
  newTestGame,
  plant,
  plantingAt,
  runTicks,
} from './test-utils';

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

  it('never mutates the input state', () => {
    const state = deepFreeze(newTestGame());
    expect(() =>
      applyCommand(state, plantCommand(state), defaultContent),
    ).not.toThrow();
  });
});
