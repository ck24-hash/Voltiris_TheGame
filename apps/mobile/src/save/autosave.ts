import type { GameState } from '@voltiris/sim';
import type { StoreApi } from 'zustand/vanilla';
import { pageLifecycle, type AppLifecycle } from '../game/lifecycle';
import type { GameStore } from '../game/store';
import { toSaveFile } from './saveFile';
import type { SaveStore } from './SaveStore';

const AUTOSAVE_INTERVAL_MS = 30_000;

export interface AutosaveOptions {
  readonly store: StoreApi<GameStore>;
  readonly saveStore: SaveStore;
  /** Device time for the save's timestamp. */
  readonly now: () => number;
  readonly intervalMs?: number;
  readonly lifecycle?: Pick<AppLifecycle, 'onHide'>;
  /** Called when saving starts failing (once until a save works again). */
  readonly onError?: (error: unknown) => void;
}

export interface Autosave {
  /** Saves the current game; resolves once it is written. */
  saveNow(): Promise<void>;
  stop(): void;
}

/**
 * Saves the game now, every 30 seconds, after every player action (the
 * store's checkpoint) and when the app goes to the background. Writes run one
 * at a time, and an unchanged game is not written again.
 */
export function startAutosave(options: AutosaveOptions): Autosave {
  const { store, saveStore, now, onError } = options;
  let lastSaved: GameState | null = null;
  let queued: Promise<void> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let failing = false;

  const write = async () => {
    queued = null;
    const { game } = store.getState();
    if (game === lastSaved) return;
    try {
      await saveStore.write(toSaveFile(game, now()));
      lastSaved = game;
      failing = false;
    } catch (error) {
      if (!failing) onError?.(error);
      failing = true;
    }
  };

  // Calls made before a queued write starts share it; it saves the latest game.
  const saveNow = () => (queued ??= chain = chain.then(write));

  const interval = setInterval(
    () => void saveNow(),
    options.intervalMs ?? AUTOSAVE_INTERVAL_MS,
  );
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.checkpoint !== previous.checkpoint) void saveNow();
  });
  const lifecycle = options.lifecycle ?? pageLifecycle;
  const stopHide = lifecycle.onHide(() => void saveNow());
  void saveNow();

  return {
    saveNow,
    stop: () => {
      clearInterval(interval);
      unsubscribe();
      stopHide();
    },
  };
}
