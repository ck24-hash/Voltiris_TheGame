// Game content as data: crops, equipment, modules, buildings, events.

import { CARE, ECONOMY, GROWTH, MARKET, STORAGE, TIME } from './config';
import { CROPS } from './crops';
import { ENERGY } from './energy';
import { EQUIPMENT } from './equipment';
import { CONTROL, GREENHOUSE, PHYSICS } from './greenhouse';
import type { GameContent } from './types';

export * from './types';
export { CROPS } from './crops';
export { CARE, ECONOMY, GROWTH, MARKET, STORAGE, TIME } from './config';
export { ENERGY } from './energy';
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
  energy: ENERGY,
  equipment: EQUIPMENT,
  control: CONTROL,
};
