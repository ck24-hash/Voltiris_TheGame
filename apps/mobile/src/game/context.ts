import { createContext, useContext } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { GameStore } from './store';

export const GameStoreContext = createContext<StoreApi<GameStore> | null>(null);

/**
 * Reads from the game store. Selectors must return existing references or
 * primitives (derive new objects in the component, not in the selector).
 */
export function useGame<T>(selector: (store: GameStore) => T): T {
  const store = useContext(GameStoreContext);
  if (!store) throw new Error('useGame needs a GameStoreContext provider');
  return useStore(store, selector);
}
