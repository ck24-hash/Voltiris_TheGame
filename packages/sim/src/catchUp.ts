import type { CropId, GameContent } from '@voltiris/content';
import type { Clock } from './clock';
import type { GameState } from './state';
import { advance } from './tick';
import { ticksDue } from './time';

/** A crop that became ready to harvest during a catch-up. */
export interface ReadyCrop {
  readonly greenhouseId: string;
  readonly plotId: string;
  readonly cropId: CropId;
  readonly readyAtHour: number;
  readonly quality: number;
  readonly yieldUnits: number;
}

/** What happened while the game caught up, for the "while you were away" summary. */
export interface CatchUpReport {
  /** Real time (ms) since the last tick. */
  readonly awayMs: number;
  /** Ticks (in-game hours) simulated. */
  readonly ticks: number;
  /** Real time (ms) not simulated because of the catch-up cap. */
  readonly skippedMs: number;
  readonly cropsReady: readonly ReadyCrop[];
  /** Harvests in storage that went off. */
  readonly spoiled: readonly SpoiledLot[];
  readonly moneyChange: number;
}

export interface SpoiledLot {
  readonly cropId: CropId;
  readonly units: number;
}

/**
 * Advances the game to `clock.now()` like `advance`, and reports what
 * happened. Used after the app was closed or asleep.
 */
export function catchUp(
  state: GameState,
  clock: Clock,
  content: GameContent,
): { readonly state: GameState; readonly report: CatchUpReport } {
  const now = clock.now();
  const { lastTickAt, gameHour } = state.clock;
  const next = advance(state, { now: () => now }, content);
  const ticks = next.clock.gameHour - gameHour;
  const due = ticksDue(lastTickAt, now, content.time.realMsPerTick);

  return {
    state: next,
    report: {
      awayMs: Math.max(0, now - lastTickAt),
      ticks,
      skippedMs: (due - ticks) * content.time.realMsPerTick,
      cropsReady: cropsReadySince(next, gameHour),
      spoiled: lotsGone(state, next),
      moneyChange: next.money - state.money,
    },
  };
}

/** Lots in storage before that are gone after: ticks only remove spoiled ones. */
function lotsGone(before: GameState, after: GameState): SpoiledLot[] {
  const kept = new Set(after.storage.lots.map((lot) => lot.id));
  return before.storage.lots
    .filter((lot) => !kept.has(lot.id))
    .map(({ cropId, units }) => ({ cropId, units }));
}

function cropsReadySince(state: GameState, sinceHour: number): ReadyCrop[] {
  return state.greenhouses.flatMap((greenhouse) =>
    greenhouse.plots.flatMap(({ id, planting }) =>
      planting?.status === 'ready' && planting.readyAtHour > sinceHour
        ? [
            {
              greenhouseId: greenhouse.id,
              plotId: id,
              cropId: planting.cropId,
              readyAtHour: planting.readyAtHour,
              quality: planting.quality,
              yieldUnits: planting.yieldUnits,
            },
          ]
        : [],
    ),
  );
}
