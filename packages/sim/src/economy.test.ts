// Phase 5 "Done when": the first loop (plant, harvest, sell) is quick and
// pays, and the crops' timings and earnings follow the design.

import {
  CROP_IDS,
  defaultContent,
  type CropId,
  type GameContent,
} from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { createManualClock } from './clock';
import { applyCommand, type Command } from './commands';
import { growthRate, stressRate } from './growth';
import { cropPrice, initialMarket } from './market';
import { createGame } from './newGame';
import type { GameState } from './state';
import { stockOf } from './storage';
import { firstGreenhouse, TEST_PLAYER_ID } from './test-utils';
import { advance } from './tick';

const content = defaultContent;
const { crops, time, care } = content;
const MINUTE = 60_000;

/** Real minutes each crop should take in the starting greenhouse. */
const TARGET_MINUTES: Record<CropId, number> = {
  microgreens: 2,
  cucumber: 7,
  strawberry: 30,
  tomato: 60,
  pepper: 120,
};

/**
 * One plot of a crop in the starting greenhouse at the start of the game:
 * how long it takes and what it earns, after seeds and the water and
 * nutrients it uses.
 */
function economics(id: CropId, c: GameContent = content) {
  const crop = c.crops[id];
  const climate = c.startingGreenhouse.climate;
  const rate = growthRate(climate, crop);
  const ticks = Math.ceil(crop.growthHours / rate);
  const quality =
    1 / (1 + c.growth.stressQualityPenalty * stressRate(climate, crop));
  const price = cropPrice(initialMarket(), id, 0, c);
  const careCost =
    (crop.growthHours * crop.waterUse * care.water.cost) / care.water.amount +
    (crop.growthHours * crop.nutrientUse * care.nutrients.cost) /
      care.nutrients.amount;
  const profit = crop.yieldPerPlot * price * quality - crop.seedCost - careCost;
  const minutes = (ticks * time.realMsPerTick) / MINUTE;
  return { minutes, profit, perHour: (profit / minutes) * 60 };
}

describe('crop timings in the starting greenhouse', () => {
  it.each(CROP_IDS)('%s takes about its target time', (id) => {
    const { minutes } = economics(id);
    expect(minutes).toBeGreaterThan(TARGET_MINUTES[id] * 0.9);
    expect(minutes).toBeLessThan(TARGET_MINUTES[id] * 1.1);
  });
});

describe('crop earnings', () => {
  it.each(CROP_IDS)('%s earns a profit from the very first planting', (id) => {
    expect(economics(id).profit).toBeGreaterThan(0);
  });

  it('pays more per harvest for slower crops, but less per hour', () => {
    const all = CROP_IDS.map((id) => economics(id));
    for (let k = 1; k < all.length; k++) {
      const [quick, slow] = [all[k - 1], all[k]];
      expect(slow?.profit).toBeGreaterThan(quick?.profit ?? Infinity);
      expect(slow?.perHour).toBeLessThan(quick?.perHour ?? 0);
    }
  });
});

/** A command without its id and time, which `run` adds. */
type WithoutMeta<C> = C extends Command ? Omit<C, 'id' | 'issuedAt'> : never;

/**
 * A new player plays for 10 minutes: plants every plot with one crop, then
 * checks in every 15 seconds, harvests what is ready, sells it all and
 * plants again, and waters or feeds when the gauge says the plants need it.
 */
function playTenMinutes(cropId: CropId) {
  const clock = createManualClock(0);
  let state: GameState = createGame(
    { playerId: TEST_PLAYER_ID, seed: 11 },
    content,
    clock,
  );
  let n = 0;
  const run = (command: WithoutMeta<Command>) => {
    const result = applyCommand(
      advance(state, clock, content),
      { ...command, id: `cmd-${n++}`, issuedAt: clock.now() },
      content,
    );
    if (result.ok) state = result.state;
    return result.ok;
  };
  const greenhouseId = firstGreenhouse(state).id;
  const plotIds = firstGreenhouse(state).plots.map((p) => p.id);
  let harvests = 0;
  let sales = 0;

  for (let t = 0; t <= 10 * MINUTE; t += time.realMsPerTick) {
    clock.set(t);
    state = advance(state, clock, content);
    for (const plotId of plotIds) {
      if (run({ type: 'HarvestCrop', greenhouseId, plotId })) harvests++;
      run({ type: 'PlantCrop', greenhouseId, plotId, cropId });
    }
    const units = stockOf(state.storage, cropId);
    if (units > 0 && run({ type: 'SellCrop', cropId, units })) sales++;
    const { water, nutrients } = firstGreenhouse(state).climate;
    const bands = crops[cropId].climate;
    if (water < bands.water.optimalLow) run({ type: 'Water', greenhouseId });
    if (nutrients < bands.nutrients.optimalLow) {
      run({ type: 'Fertilize', greenhouseId });
    }
  }
  return { state, harvests, sales };
}

describe('the first 10 minutes', () => {
  it.each(['microgreens', 'cucumber'] as const)(
    'growing %s, a new player plants, harvests, sells and makes a profit',
    (cropId) => {
      const { state, harvests, sales } = playTenMinutes(cropId);
      expect(harvests).toBeGreaterThanOrEqual(4);
      expect(sales).toBeGreaterThanOrEqual(1);
      // Money now plus the seeds already in the ground for the next round.
      const replanted = firstGreenhouse(state).plots.filter(
        (p) => p.planting !== null,
      ).length;
      const worth = state.money + replanted * crops[cropId].seedCost;
      expect(worth).toBeGreaterThan(content.economy.startingMoney);
    },
  );
});
