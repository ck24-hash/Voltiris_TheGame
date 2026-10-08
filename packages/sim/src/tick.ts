import type { GameContent } from '@voltiris/content';
import type { Clock } from './clock';
import { growPlanting } from './growth';
import type { GameState, Greenhouse } from './state';
import { ticksDue } from './time';

/** Advances the game by exactly one tick (one in-game hour). */
export function tick(state: GameState, content: GameContent): GameState {
  const gameHour = state.clock.gameHour + 1;
  return {
    ...state,
    clock: { ...state.clock, gameHour },
    greenhouses: state.greenhouses.map((greenhouse) =>
      tickGreenhouse(greenhouse, gameHour, content),
    ),
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

function tickGreenhouse(
  greenhouse: Greenhouse,
  gameHour: number,
  content: GameContent,
): Greenhouse {
  return {
    ...greenhouse,
    plots: greenhouse.plots.map((plot) => {
      const { planting } = plot;
      if (planting?.status !== 'growing') return plot;
      return {
        ...plot,
        planting: growPlanting(
          planting,
          greenhouse.climate,
          content.crops[planting.cropId],
          gameHour,
          content.growth,
        ),
      };
    }),
  };
}
