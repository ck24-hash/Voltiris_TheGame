import type { ClimateVariable, EquipmentKind } from '@voltiris/content';

interface ClimateInfo {
  /** Why the plants care, in a sentence. */
  readonly why: string;
  /** What raises it and what lowers it. */
  readonly raise: string;
  readonly lower: string;
  /** A short tip for the plot bubble when it is too low, or too high. */
  readonly fixLow: string;
  readonly fixHigh: string;
  /** The equipment that works on it, to the targets the player sets. */
  readonly equipment: readonly EquipmentKind[];
}

export const CLIMATE_INFO: Record<ClimateVariable, ClimateInfo> = {
  temperature: {
    why: 'Warmth sets how fast plants grow: in the cold they crawl, in the heat they suffer.',
    raise: 'A heater. Double glass keeps the sun’s heat in.',
    lower: 'Vents let the heat out.',
    fixLow: 'A heater helps',
    fixHigh: 'Vents help',
    equipment: ['heater', 'vents'],
  },
  humidity: {
    why: 'Plants like moist air: dry air makes them close up, very damp air brings disease.',
    raise: 'A fogger. Growing plants add moisture too.',
    lower: 'Vents let damp air out, and heating dries it.',
    fixLow: 'A fogger helps',
    fixHigh: 'Vents help',
    equipment: ['fogger', 'vents'],
  },
  co2: {
    why: 'Plants build themselves from the CO₂ in the air: more CO₂, faster growth.',
    raise: 'A CO₂ injector. A gas heater’s exhaust adds a little.',
    lower: 'Growing plants use it up; vents let it out.',
    fixLow: 'A CO₂ injector helps',
    fixHigh: 'Lower the CO₂ target',
    equipment: ['co2'],
  },
  light: {
    why: 'Light is the plants’ energy: more light, faster growth, up to a point.',
    raise: 'Grow lights. Diffuse glass lets more sun in.',
    lower: 'A lower light target. Double glass is a little darker.',
    fixLow: 'Grow lights help',
    fixHigh: 'Lower the light target',
    equipment: ['lights'],
  },
  water: {
    why: 'Roots need water: thirsty plants stop growing and lose quality.',
    raise: 'Watering by hand (the + button), or irrigation.',
    lower: 'The plants drink it as they grow.',
    fixLow: 'Water it',
    fixHigh: 'Let it drink',
    equipment: ['irrigation'],
  },
};
