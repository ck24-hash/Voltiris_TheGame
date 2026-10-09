import {
  EQUIPMENT_KINDS,
  SETPOINT_IDS,
  type GameContent,
  type SetpointId,
  type Setpoints,
} from '@voltiris/content';
import { fail, findGreenhouse, updateGreenhouse } from './commandHelpers';
import type {
  BuyEquipmentCommand,
  CommandResult,
  ServiceEquipmentCommand,
  SetAutoControlCommand,
  SetSetpointCommand,
  UpgradeGreenhouseCommand,
} from './commands';
import { GREENHOUSE_UPGRADES, serviceCost } from './equipment';
import { createRng } from './rng';
import type { GameState, Greenhouse } from './state';

// Commands may come from untrusted input later, so check names at runtime.
function isOneOf(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

/** Pays `price` and puts the changed greenhouse in place. */
function buy(
  state: GameState,
  greenhouse: Greenhouse,
  price: number,
): CommandResult {
  if (state.money < price) {
    return fail('NOT_ENOUGH_MONEY', `It costs ${price}`);
  }
  return {
    ok: true,
    state: {
      ...updateGreenhouse(state, greenhouse),
      money: state.money - price,
    },
  };
}

export function buyEquipment(
  state: GameState,
  command: BuyEquipmentCommand,
  content: GameContent,
): CommandResult {
  const { kind } = command;
  if (!isOneOf(EQUIPMENT_KINDS, kind)) {
    return fail('UNKNOWN_EQUIPMENT', `Unknown equipment "${kind}"`);
  }
  const found = findGreenhouse(state, command.greenhouseId);
  if (!found.ok) return found;
  const { greenhouse } = found;
  const level = (greenhouse.equipment[kind]?.level ?? 0) + 1;
  const next = content.equipment.levels[kind][level - 1];
  if (!next) return fail('MAX_LEVEL', `The ${kind} is at its top level`);
  return buy(
    state,
    {
      ...greenhouse,
      equipment: { ...greenhouse.equipment, [kind]: { level, wear: 0 } },
    },
    next.price,
  );
}

export function serviceEquipment(
  state: GameState,
  command: ServiceEquipmentCommand,
  content: GameContent,
): CommandResult {
  const { kind } = command;
  if (!isOneOf(EQUIPMENT_KINDS, kind)) {
    return fail('UNKNOWN_EQUIPMENT', `Unknown equipment "${kind}"`);
  }
  const found = findGreenhouse(state, command.greenhouseId);
  if (!found.ok) return found;
  const { greenhouse } = found;
  const device = greenhouse.equipment[kind];
  if (!device) return fail('NOT_INSTALLED', `There is no ${kind}`);
  if (device.wear === 0)
    return fail('NOT_WORN', `The ${kind} is as good as new`);
  return buy(
    state,
    {
      ...greenhouse,
      equipment: { ...greenhouse.equipment, [kind]: { ...device, wear: 0 } },
    },
    serviceCost(kind, device, content),
  );
}

export function setSetpoint(
  state: GameState,
  command: SetSetpointCommand,
  content: GameContent,
): CommandResult {
  const { setpoint, value } = command;
  if (!isOneOf(SETPOINT_IDS, setpoint)) {
    return fail('UNKNOWN_SETPOINT', `Unknown setpoint "${setpoint}"`);
  }
  const range = content.control.ranges[setpoint];
  if (!Number.isFinite(value) || value < range.min || value > range.max) {
    return fail(
      'INVALID_AMOUNT',
      `${setpoint} goes from ${range.min} to ${range.max}`,
    );
  }
  const found = findGreenhouse(state, command.greenhouseId);
  if (!found.ok) return found;
  const { greenhouse } = found;
  return {
    ok: true,
    state: updateGreenhouse(state, {
      ...greenhouse,
      setpoints: withSetpoint(greenhouse.setpoints, setpoint, value, content),
    }),
  };
}

/** Sets one setpoint, pushing its partner along to keep their gap. */
function withSetpoint(
  setpoints: Setpoints,
  id: SetpointId,
  value: number,
  content: GameContent,
): Setpoints {
  const { temperatureGap, humidityGap } = content.control;
  const next = { ...setpoints, [id]: value };
  switch (id) {
    case 'heatTo':
      return {
        ...next,
        ventAbove: Math.max(next.ventAbove, value + temperatureGap),
      };
    case 'ventAbove':
      return { ...next, heatTo: Math.min(next.heatTo, value - temperatureGap) };
    case 'humidityMin':
      return {
        ...next,
        humidityMax: Math.max(next.humidityMax, value + humidityGap),
      };
    case 'humidityMax':
      return {
        ...next,
        humidityMin: Math.min(next.humidityMin, value - humidityGap),
      };
    default:
      return next;
  }
}

export function setAutoControl(
  state: GameState,
  command: SetAutoControlCommand,
): CommandResult {
  const found = findGreenhouse(state, command.greenhouseId);
  if (!found.ok) return found;
  const { greenhouse } = found;
  if (!greenhouse.computer) {
    return fail('NO_COMPUTER', 'The greenhouse has no climate computer');
  }
  return {
    ok: true,
    state: updateGreenhouse(state, {
      ...greenhouse,
      auto: command.auto === true,
    }),
  };
}

export function upgradeGreenhouse(
  state: GameState,
  command: UpgradeGreenhouseCommand,
  content: GameContent,
): CommandResult {
  const { upgrade } = command;
  if (!isOneOf(GREENHOUSE_UPGRADES, upgrade)) {
    return fail('UNKNOWN_UPGRADE', `Unknown upgrade "${upgrade}"`);
  }
  const found = findGreenhouse(state, command.greenhouseId);
  if (!found.ok) return found;
  const { greenhouse } = found;
  const { glass, sizes, climateComputer } = content.greenhouse;

  switch (upgrade) {
    case 'glass': {
      const next = glass[greenhouse.glass];
      if (!next) return fail('MAX_LEVEL', 'The glass is the best there is');
      return buy(
        state,
        { ...greenhouse, glass: greenhouse.glass + 1 },
        next.price,
      );
    }
    case 'size': {
      const next = sizes[greenhouse.size];
      if (!next) return fail('MAX_LEVEL', 'The greenhouse is at its largest');
      // New plots get their ids from the seeded rng, like the first ones.
      const rng = createRng(state.rng);
      const added = Array.from(
        { length: Math.max(0, next.plots - greenhouse.plots.length) },
        () => ({ id: rng.uuid(), planting: null }),
      );
      const bought = buy(
        state,
        {
          ...greenhouse,
          size: greenhouse.size + 1,
          plots: [...greenhouse.plots, ...added],
        },
        next.price,
      );
      return bought.ok
        ? { ok: true, state: { ...bought.state, rng: rng.snapshot() } }
        : bought;
    }
    case 'computer':
      if (greenhouse.computer) {
        return fail('MAX_LEVEL', 'The greenhouse has a climate computer');
      }
      return buy(
        state,
        { ...greenhouse, computer: true, auto: true },
        climateComputer.price,
      );
  }
}
