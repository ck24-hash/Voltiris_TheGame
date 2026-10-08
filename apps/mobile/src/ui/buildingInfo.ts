import type { BuildingId } from '../iso/layout';

/** The game mode each building on the map opens. */
export const BUILDING_INFO: Record<
  BuildingId,
  { readonly title: string; readonly building: string; readonly text: string }
> = {
  market: {
    title: 'Market',
    building: 'Market stall',
    text: 'Sell your harvest at changing prices and fill customer orders.',
  },
  energy: {
    title: 'Energy',
    building: 'Energy shed',
    text: 'Power your greenhouses with the grid, solar panels, batteries and Voltiris modules.',
  },
  village: {
    title: 'Village',
    building: 'Town hall',
    text: 'Grow from one greenhouse into a whole complex: buy land, build and upgrade.',
  },
};
