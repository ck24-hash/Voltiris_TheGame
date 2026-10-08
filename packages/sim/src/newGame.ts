import type { GameContent } from '@voltiris/content';
import type { Clock } from './clock';
import { initialMarket } from './market';
import { createRng, seedRng } from './rng';
import { STATE_VERSION, type GameState, type Greenhouse } from './state';

export interface NewGameOptions {
  /** UUID generated outside the sim (e.g. crypto.randomUUID()). */
  readonly playerId: string;
  /** Seed for the game's random stream; normalized to an unsigned 32-bit integer. */
  readonly seed: number;
}

export function createGame(
  options: NewGameOptions,
  content: GameContent,
  clock: Clock,
): GameState {
  const rng = createRng(seedRng(options.seed));
  const { plots, climate } = content.startingGreenhouse;

  const greenhouse: Greenhouse = {
    id: rng.uuid(),
    climate: { ...climate },
    plots: Array.from({ length: plots }, () => ({
      id: rng.uuid(),
      planting: null,
    })),
  };

  return {
    version: STATE_VERSION,
    playerId: options.playerId,
    clock: { gameHour: 0, lastTickAt: clock.now() },
    rng: rng.snapshot(),
    money: content.economy.startingMoney,
    greenhouses: [greenhouse],
    storage: { lots: [] },
    market: initialMarket(),
  };
}
