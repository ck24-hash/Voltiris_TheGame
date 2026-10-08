// Game content as data: crops, equipment, modules, buildings, events.

import {
  CARE,
  ECONOMY,
  GROWTH,
  MARKET,
  STARTING_GREENHOUSE,
  STORAGE,
  TIME,
} from './config';
import { CROPS } from './crops';
import type { GameContent } from './types';

export * from './types';
export { CROPS } from './crops';
export {
  CARE,
  ECONOMY,
  GROWTH,
  MARKET,
  STARTING_GREENHOUSE,
  STORAGE,
  TIME,
} from './config';

export const defaultContent: GameContent = {
  time: TIME,
  crops: CROPS,
  startingGreenhouse: STARTING_GREENHOUSE,
  economy: ECONOMY,
  growth: GROWTH,
  care: CARE,
  storage: STORAGE,
  market: MARKET,
};
