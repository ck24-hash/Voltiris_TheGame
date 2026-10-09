// Game content as data: crops, equipment, modules, buildings, events.

import {
  CARE,
  ECONOMY,
  ENERGY_PRICES,
  GROWTH,
  MARKET,
  STORAGE,
  TIME,
} from './config';
import { CROPS } from './crops';
import { EQUIPMENT } from './equipment';
import { CONTROL, GREENHOUSE, PHYSICS } from './greenhouse';
import type { GameContent } from './types';

export * from './types';
export { CROPS } from './crops';
export {
  CARE,
  ECONOMY,
  ENERGY_PRICES,
  GROWTH,
  MARKET,
  STORAGE,
  TIME,
} from './config';
export { EQUIPMENT } from './equipment';
export { CONTROL, GREENHOUSE, PHYSICS } from './greenhouse';

export const defaultContent: GameContent = {
  time: TIME,
  crops: CROPS,
  economy: ECONOMY,
  growth: GROWTH,
  care: CARE,
  storage: STORAGE,
  market: MARKET,
  greenhouse: GREENHOUSE,
  physics: PHYSICS,
  energyPrices: ENERGY_PRICES,
  equipment: EQUIPMENT,
  control: CONTROL,
};
