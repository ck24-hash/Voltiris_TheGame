import type { CropId, GameContent } from '@voltiris/content';
import {
  advance as advanceGame,
  applyCommand,
  type Clock,
  type Command,
  type CommandError,
  type CommandMeta,
  type GameState,
} from '@voltiris/sim';
import { createStore, type StoreApi } from 'zustand/vanilla';

export type Tab = 'greenhouse' | 'market' | 'energy' | 'village';

export interface GameStore {
  readonly content: GameContent;
  readonly game: GameState;
  readonly selectedPlotId: string | null;
  readonly tab: Tab;
  readonly lastError: CommandError | null;
  // Actions are arrow-typed properties: components pull them off the store.
  /** Runs every tick that is due by now. */
  readonly advance: () => void;
  readonly plantCrop: (
    greenhouseId: string,
    plotId: string,
    cropId: CropId,
  ) => void;
  readonly selectPlot: (plotId: string | null) => void;
  readonly setTab: (tab: Tab) => void;
}

export interface GameStoreDeps {
  readonly content: GameContent;
  readonly clock: Clock;
  readonly newId: () => string;
  readonly game: GameState;
}

/** UI state around the sim. The UI only reads state and sends commands. */
export function createGameStore(deps: GameStoreDeps): StoreApi<GameStore> {
  const { content, clock, newId } = deps;

  return createStore<GameStore>()((set, get) => {
    const run = (build: (meta: CommandMeta) => Command) => {
      // Read the clock once: catch up to that instant, so the command lands
      // at the game hour its timestamp belongs to (a replay must agree).
      const now = clock.now();
      const game = advanceGame(get().game, { now: () => now }, content);
      const result = applyCommand(
        game,
        build({ id: newId(), issuedAt: now }),
        content,
      );
      set(
        result.ok
          ? { game: result.state, lastError: null }
          : { game, lastError: result.error },
      );
    };

    return {
      content,
      game: deps.game,
      selectedPlotId: null,
      tab: 'greenhouse',
      lastError: null,

      advance: () => {
        const current = get().game;
        const game = advanceGame(current, clock, content);
        if (game !== current) set({ game });
      },

      plantCrop: (greenhouseId, plotId, cropId) => {
        run((meta) => ({
          ...meta,
          type: 'PlantCrop',
          greenhouseId,
          plotId,
          cropId,
        }));
      },

      selectPlot: (plotId) => {
        set({ selectedPlotId: plotId, lastError: null });
      },

      setTab: (tab) => {
        set({ tab, selectedPlotId: null });
      },
    };
  });
}

/** Advances the game on a timer; returns a function that stops it. */
export function startGameLoop(
  store: StoreApi<GameStore>,
  intervalMs = 500,
): () => void {
  store.getState().advance();
  const id = setInterval(() => store.getState().advance(), intervalMs);
  return () => clearInterval(id);
}
