import type { GameContent } from '@voltiris/content';
import type { Clock } from './clock';
import { growPlanting } from './growth';
import { tickMarket } from './market';
import { createRng } from './rng';
import type { GameState, Greenhouse, Plot } from './state';
import { removeSpoiled } from './storage';
import { ticksDue } from './time';

/** Advances the game by exactly one tick (one in-game hour). */
export function tick(state: GameState, content: GameContent): GameState {
  const gameHour = state.clock.gameHour + 1;
  const rng = createRng(state.rng);
  const market = tickMarket(state.market, rng, content.market);
  return {
    ...state,
    clock: { ...state.clock, gameHour },
    rng: rng.snapshot(),
    greenhouses: state.greenhouses.map((greenhouse) =>
      tickGreenhouse(greenhouse, gameHour, content),
    ),
    storage: removeSpoiled(state.storage, gameHour, content),
    market,
  };
}

/**
 * Runs every tick that has come due by `clock.now()`. Leftover time below one
 * tick carries over, so ticks never drift. At most `maxCatchUpMs` of real time
 * is simulated; time beyond that is skipped. If the clock went backwards (the
 * device time was changed), time restarts from now instead of freezing until
 * the clock catches up.
 */
export function advance(
  state: GameState,
  clock: Clock,
  content: GameContent,
): GameState {
  const { realMsPerTick } = content.time;
  const now = clock.now();
  if (now < state.clock.lastTickAt) {
    return { ...state, clock: { ...state.clock, lastTickAt: now } };
  }
  const due = ticksDue(state.clock.lastTickAt, now, realMsPerTick);
  if (due === 0) return state;

  const run = Math.min(due, maxCatchUpTicks(content));
  let next = state;
  for (let i = 0; i < run; i++) next = tick(next, content);

  // Skipped ticks still use up their time, so the game resumes from now.
  return {
    ...next,
    clock: {
      ...next.clock,
      lastTickAt: state.clock.lastTickAt + due * realMsPerTick,
    },
  };
}

/** Most ticks one call to `advance` runs. */
export function maxCatchUpTicks(content: GameContent): number {
  return Math.floor(content.time.maxCatchUpMs / content.time.realMsPerTick);
}

/**
 * Grows every crop in the greenhouse by one tick, in the climate at the start
 * of the tick. Crops then take up water and nutrients in proportion to how
 * much they grew, so a crop that has stopped growing uses none.
 */
function tickGreenhouse(
  greenhouse: Greenhouse,
  gameHour: number,
  content: GameContent,
): Greenhouse {
  let waterUsed = 0;
  let nutrientsUsed = 0;
  const plots = greenhouse.plots.map((plot): Plot => {
    const { planting } = plot;
    if (planting?.status !== 'growing') return plot;
    const crop = content.crops[planting.cropId];
    const next = growPlanting(
      planting,
      greenhouse.climate,
      crop,
      gameHour,
      content.growth,
    );
    const grown = next.growthHours - planting.growthHours;
    waterUsed += grown * crop.waterUse;
    nutrientsUsed += grown * crop.nutrientUse;
    return { ...plot, planting: next };
  });
  if (waterUsed === 0 && nutrientsUsed === 0) return { ...greenhouse, plots };

  const { water, nutrients } = greenhouse.climate;
  return {
    ...greenhouse,
    climate: {
      ...greenhouse.climate,
      water: Math.max(0, water - waterUsed),
      nutrients: Math.max(0, nutrients - nutrientsUsed),
    },
    plots,
  };
}
