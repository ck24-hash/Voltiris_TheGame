import type { GameState } from '@voltiris/sim';
import { createContext, useContext } from 'react';

/** How an exported save reached the player. */
export type ExportMethod = 'downloaded' | 'copied';

/** App-level services the UI needs beyond the game store. */
export interface AppServices {
  /** A fresh game, for "New game". */
  readonly newGame: () => GameState;
  /** Device time (ms), for save timestamps. */
  readonly now: () => number;
  /** Hands exported save text to the player. */
  readonly exportText: (
    text: string,
    fileName: string,
  ) => Promise<ExportMethod>;
}

export const ServicesContext = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services)
    throw new Error('useServices needs a ServicesContext provider');
  return services;
}
