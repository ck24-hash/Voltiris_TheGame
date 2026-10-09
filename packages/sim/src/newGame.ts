import type { GameContent } from '@voltiris/content';
import type { Clock } from './clock';
import { initialEnergy } from './energy';
import { levelAt } from './equipment';
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
  const { startingClimate, sizes } = content.greenhouse;

  const greenhouse: Greenhouse = {
    id: rng.uuid(),
    climate: { ...startingClimate },
    plots: Array.from({ length: levelAt(sizes, 1).plots }, () => ({
      id: rng.uuid(),
      planting: null,
    })),
    glass: 1,
    size: 1,
    equipment: {},
    setpoints: { ...content.control.initial },
    computer: false,
    auto: false,
  };

  return {
    version: STATE_VERSION,
    playerId: options.playerId,
    clock: { gameHour: 0, lastTickAt: clock.now() },
    rng: rng.snapshot(),
    money: content.economy.startingMoney,
    owed: 0,
    greenhouses: [greenhouse],
    storage: { lots: [] },
    market: initialMarket(),
    energy: initialEnergy(),
  };
}
