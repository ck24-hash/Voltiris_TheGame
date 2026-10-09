import type {
  ClimateVariable,
  EnergyAsset,
  EquipmentKind,
  SetpointId,
} from '@voltiris/content';
import { formatPercent } from '../game/format';

interface EquipmentInfo {
  readonly name: string;
  /** What it is for, shown before it is bought. */
  readonly does: string;
}

export const EQUIPMENT_INFO: Record<EquipmentKind, EquipmentInfo> = {
  heater: { name: 'Heater', does: 'Warms the air when it is too cold.' },
  vents: { name: 'Vents', does: 'Let out heat and damp air.' },
  fogger: { name: 'Fogger', does: 'Mists dry air to make it humid.' },
  co2: { name: 'CO₂ injector', does: 'Feeds the plants CO₂ to grow faster.' },
  lights: {
    name: 'Grow lights',
    does: 'Add light when the sun is not enough.',
  },
  irrigation: {
    name: 'Irrigation',
    does: 'Waters the plants by itself.',
  },
};

/** What a device is doing this hour, from how hard it works (0–1). */
export function deviceStatus(kind: EquipmentKind, load: number): string {
  const share = formatPercent(load);
  const working = load > 0;
  switch (kind) {
    case 'heater':
      return working ? `Heating · ${share}` : 'Idle: warm enough';
    case 'vents':
      return working ? `Open ${share}` : 'Closed';
    case 'fogger':
      return working ? `Fogging · ${share}` : 'Idle: humid enough';
    case 'co2':
      return working ? `Adding CO₂ · ${share}` : 'Idle: enough CO₂';
    case 'lights':
      return working ? `On · ${share}` : 'Off: bright enough';
    case 'irrigation':
      return working ? 'Watering' : 'Idle: watered';
  }
}

export const ENERGY_INFO: Record<EnergyAsset, EquipmentInfo> = {
  solar: {
    name: 'Solar panels',
    does: 'Make power while the sun is up, most at midday.',
  },
  battery: {
    name: 'Battery',
    does: 'Keeps spare solar and cheap night power for the dear evening.',
  },
  chp: {
    name: 'CHP unit',
    does: 'Burns gas for power; its heat warms the greenhouse and its CO₂ feeds the plants. Runs when it saves money.',
  },
};

interface SetpointInfo {
  readonly label: string;
  /** The climate reading it is a target for. */
  readonly variable: ClimateVariable;
}

export const SETPOINT_INFO: Record<SetpointId, SetpointInfo> = {
  heatTo: { label: 'Heat up to', variable: 'temperature' },
  ventAbove: { label: 'Cool above', variable: 'temperature' },
  humidityMax: { label: 'Dry above', variable: 'humidity' },
  humidityMin: { label: 'Fog below', variable: 'humidity' },
  co2: { label: 'Keep CO₂ at', variable: 'co2' },
  light: { label: 'Light up to', variable: 'light' },
  water: { label: 'Water up to', variable: 'water' },
};
