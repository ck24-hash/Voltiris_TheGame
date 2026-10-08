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
 * tick carries over, so ticks never drift.
 */
export function advance(
  state: GameState,
  clock: Clock,
  content: GameContent,
): GameState {
  const { realMsPerTick } = content.time;
  const due = ticksDue(state.clock.lastTickAt, clock.now(), realMsPerTick);
  if (due === 0) return state;

  let next = state;
  for (let i = 0; i < due; i++) next = tick(next, content);

  return {
    ...next,
    clock: {
      ...next.clock,
      lastTickAt: state.clock.lastTickAt + due * realMsPerTick,
    },
  };
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
