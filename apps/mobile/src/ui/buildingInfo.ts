import type { BuildingId } from '../iso/layout';

interface BuildingInfo {
  readonly title: string;
  readonly building: string;
  readonly text: string;
  /** Its game mode comes in a later phase: "Soon" tag and traffic cones. */
  readonly soon: boolean;
}

/** The game mode each building on the map opens. */
export const BUILDING_INFO: Record<BuildingId, BuildingInfo> = {
  market: {
    title: 'Market',
    building: 'Market stall',
    text: 'Sell your harvest at prices that change with the seasons and the market.',
    soon: false,
  },
  storage: {
    title: 'Storage',
    building: 'Storage barn',
    text: 'Your harvest waits here to be sold. Produce loses freshness over time, so sell before it spoils.',
    soon: false,
  },
  energy: {
    title: 'Energy',
    building: 'Energy shed',
    text: 'Power for your greenhouses: the grid, solar panels, a battery and a CHP unit.',
    soon: false,
  },
  village: {
    title: 'Village',
    building: 'Town hall',
    text: 'Grow from one greenhouse into a whole complex: buy land, build and upgrade.',
    soon: true,
  },
};
