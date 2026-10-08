// Phase 2 "Done when" scenarios, run through the public commands and tick.

import { CROP_IDS, defaultContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { growthRate, requiredGrowthHours } from './growth';
import type { GameState } from './state';
import {
  firstGreenhouse,
  newTestGame,
  optimalClimate,
  plant,
  plantingAt,
  runTicks,
  withClimate,
} from './test-utils';

const { crops } = defaultContent;

/** Ticks until the crop in plot 0 is ready, or Infinity within `limit`. */
function ticksToReady(state: GameState, limit = 5000): number {
  let next = state;
  for (let i = 1; i <= limit; i++) {
    next = runTicks(next, 1);
    if (plantingAt(next)?.status === 'ready') return i;
  }
  return Infinity;
}

describe('a tomato in good conditions', () => {
  const start = plant(
    withClimate(newTestGame(), optimalClimate('tomato')),
    'tomato',
  );

  it('is ready to harvest after exactly 30 in-game days (720 ticks)', () => {
    expect(plantingAt(runTicks(start, 719))?.status).toBe('growing');
    expect(plantingAt(runTicks(start, 720))).toMatchObject({
      status: 'ready',
      plantedAtHour: 0,
      readyAtHour: 720,
      quality: 1,
      yieldUnits: 10,
    });
  });
});

describe('a tomato in a cold greenhouse (14 °C)', () => {
  const cold = { ...optimalClimate('tomato'), temperature: 14 };
  const start = plant(withClimate(newTestGame(), cold), 'tomato');

  it('grows more slowly', () => {
    expect(plantingAt(runTicks(start, 720))?.status).toBe('growing');
    const expectedTicks = Math.ceil(
      requiredGrowthHours(crops.tomato) / growthRate(cold, crops.tomato),
    );
    expect(expectedTicks).toBeGreaterThan(720);
    expect(ticksToReady(start)).toBe(expectedTicks);
  });

  it('ends with lower quality', () => {
    const ready = plantingAt(runTicks(start, ticksToReady(start)));
    if (ready?.status !== 'ready') throw new Error('expected a ready crop');
    // 14 °C is halfway to the tomato's 10 °C limit: factor 0.5, so stress
    // is 0.5 per hour (stressBelow 1), and quality = 1 / (1 + 0.5).
    expect(ready.quality).toBeCloseTo(2 / 3, 10);
  });
});

describe('climate at a crop limit', () => {
  it('stops growth completely while stress keeps building', () => {
    const frozen = { ...optimalClimate('tomato'), temperature: 10 };
    const state = runTicks(
      plant(withClimate(newTestGame(), frozen), 'tomato'),
      100,
    );
    expect(plantingAt(state)).toMatchObject({
      status: 'growing',
      growthHours: 0,
    });
    expect(plantingAt(state)?.stress).toBeGreaterThan(0);
  });
});

describe.each(CROP_IDS)('%s in the starting greenhouse', (cropId) => {
  it('grows slower and ends with lower quality than in optimal climate', () => {
    const optimal = plant(
      withClimate(newTestGame(), optimalClimate(cropId)),
      cropId,
    );
    const starting = plant(newTestGame(), cropId);

    const optimalTicks = ticksToReady(optimal);
    const startingTicks = ticksToReady(starting);
    expect(optimalTicks).toBe(requiredGrowthHours(crops[cropId]));
    expect(startingTicks).toBeGreaterThan(optimalTicks);

    const optimalReady = plantingAt(runTicks(optimal, optimalTicks));
    const startingReady = plantingAt(runTicks(starting, startingTicks));
    if (optimalReady?.status !== 'ready' || startingReady?.status !== 'ready') {
      throw new Error('expected ready crops');
    }
    expect(startingReady.quality).toBeLessThan(optimalReady.quality);
  });
});

describe('determinism', () => {
  /** Plants all three crops in the (non-optimal) starting climate and runs. */
  function scenario(seed: number, ticks: number): GameState {
    let state = newTestGame(seed);
    state = plant(state, 'tomato', 0);
    state = runTicks(state, 13);
    state = plant(state, 'cucumber', 1);
    state = runTicks(state, 50);
    state = plant(state, 'pepper', 2);
    return runTicks(state, ticks);
  }

  it('gives identical results for the same seed and commands', () => {
    expect(scenario(42, 1000)).toEqual(scenario(42, 1000));
  });

  it('gives different ids for different seeds, with the same game rules', () => {
    const a = scenario(1, 1000);
    const b = scenario(2, 1000);
    expect(firstGreenhouse(a).id).not.toBe(firstGreenhouse(b).id);
    expect(firstGreenhouse(a).plots.map((p) => p.planting)).toEqual(
      firstGreenhouse(b).plots.map((p) => p.planting),
    );
  });

  it('is unaffected by saving and reloading mid-game (JSON round-trip)', () => {
    const midGame = scenario(42, 400);
    const reloaded = JSON.parse(JSON.stringify(midGame)) as GameState;
    expect(runTicks(reloaded, 600)).toEqual(runTicks(midGame, 600));
    expect(runTicks(reloaded, 600)).toEqual(scenario(42, 1000));
  });
});
