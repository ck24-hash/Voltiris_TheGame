import type {
  CropId,
  EquipmentKind,
  GameContent,
  SetpointId,
} from '@voltiris/content';
import {
  fail,
  findGreenhouse,
  updateGreenhouse,
  type Failure,
} from './commandHelpers';
import type { GreenhouseUpgrade } from './equipment';
import {
  buyEquipment,
  serviceEquipment,
  setAutoControl,
  setSetpoint,
  upgradeGreenhouse,
} from './greenhouseCommands';
import { cropPrice } from './market';
import { createRng } from './rng';
import type { GameState, Greenhouse, Plot } from './state';
import { sell, stockOf, storedUnits } from './storage';

export interface CommandMeta {
  /** UUID, so commands can later be sent to and validated by a server. */
  readonly id: string;
  /** Real time (ms) at which the player issued the command. */
  readonly issuedAt: number;
}

/** Sows a crop in an empty plot; costs the crop's seeds. */
export interface PlantCropCommand extends CommandMeta {
  readonly type: 'PlantCrop';
  readonly greenhouseId: string;
  readonly plotId: string;
  readonly cropId: CropId;
}

/** Irrigates a greenhouse once: raises its water by the care amount. */
export interface WaterCommand extends CommandMeta {
  readonly type: 'Water';
  readonly greenhouseId: string;
}

/** Feeds a greenhouse once: raises its nutrients (EC) by the care amount. */
export interface FertilizeCommand extends CommandMeta {
  readonly type: 'Fertilize';
  readonly greenhouseId: string;
}

/** Picks a ready crop and puts the harvest in storage. */
export interface HarvestCropCommand extends CommandMeta {
  readonly type: 'HarvestCrop';
  readonly greenhouseId: string;
  readonly plotId: string;
}

/** Sells units of a crop from storage at today's market price. */
export interface SellCropCommand extends CommandMeta {
  readonly type: 'SellCrop';
  readonly cropId: CropId;
  readonly units: number;
}

/** Installs a device, or upgrades it to its next level (as good as new). */
export interface BuyEquipmentCommand extends CommandMeta {
  readonly type: 'BuyEquipment';
  readonly greenhouseId: string;
  readonly kind: EquipmentKind;
}

/** Services a worn device back to new, for a share of its price. */
export interface ServiceEquipmentCommand extends CommandMeta {
  readonly type: 'ServiceEquipment';
  readonly greenhouseId: string;
  readonly kind: EquipmentKind;
}

/**
 * Sets one of the targets the equipment works to. Heating stays below
 * venting, and fogging below venting: moving one pushes the other along.
 */
export interface SetSetpointCommand extends CommandMeta {
  readonly type: 'SetSetpoint';
  readonly greenhouseId: string;
  readonly setpoint: SetpointId;
  readonly value: number;
}

/** Lets the climate computer set the targets, or gives them back to the player. */
export interface SetAutoControlCommand extends CommandMeta {
  readonly type: 'SetAutoControl';
  readonly greenhouseId: string;
  readonly auto: boolean;
}

/** Buys the greenhouse's next glass or size, or a climate computer. */
export interface UpgradeGreenhouseCommand extends CommandMeta {
  readonly type: 'UpgradeGreenhouse';
  readonly greenhouseId: string;
  readonly upgrade: GreenhouseUpgrade;
}

export type Command =
  | PlantCropCommand
  | WaterCommand
  | FertilizeCommand
  | HarvestCropCommand
  | SellCropCommand
  | BuyEquipmentCommand
  | ServiceEquipmentCommand
  | SetSetpointCommand
  | SetAutoControlCommand
  | UpgradeGreenhouseCommand;

export type CommandErrorCode =
  | 'UNKNOWN_COMMAND'
  | 'GREENHOUSE_NOT_FOUND'
  | 'PLOT_NOT_FOUND'
  | 'PLOT_OCCUPIED'
  | 'PLOT_EMPTY'
  | 'NOT_READY'
  | 'UNKNOWN_CROP'
  | 'NOT_ENOUGH_MONEY'
  | 'ALREADY_FULL'
  | 'STORAGE_FULL'
  | 'INVALID_AMOUNT'
  | 'NOT_ENOUGH_STOCK'
  | 'UNKNOWN_EQUIPMENT'
  | 'UNKNOWN_SETPOINT'
  | 'UNKNOWN_UPGRADE'
  | 'MAX_LEVEL'
  | 'NOT_INSTALLED'
  | 'NOT_WORN'
  | 'NO_COMPUTER';

export interface CommandError {
  readonly code: CommandErrorCode;
  readonly message: string;
}

export type CommandResult =
  { readonly ok: true; readonly state: GameState } | Failure;

/**
 * Applies a player command at the current game hour. Run due ticks first (see
 * `advance`) so the command lands at the right time. A rejected command
 * leaves the state untouched.
 */
export function applyCommand(
  state: GameState,
  command: Command,
  content: GameContent,
): CommandResult {
  switch (command.type) {
    case 'PlantCrop':
      return plantCrop(state, command, content);
    case 'Water':
      return topUp(state, command.greenhouseId, 'water', content);
    case 'Fertilize':
      return topUp(state, command.greenhouseId, 'nutrients', content);
    case 'HarvestCrop':
      return harvestCrop(state, command, content);
    case 'SellCrop':
      return sellCrop(state, command, content);
    case 'BuyEquipment':
      return buyEquipment(state, command, content);
    case 'ServiceEquipment':
      return serviceEquipment(state, command, content);
    case 'SetSetpoint':
      return setSetpoint(state, command, content);
    case 'SetAutoControl':
      return setAutoControl(state, command);
    case 'UpgradeGreenhouse':
      return upgradeGreenhouse(state, command, content);
    default: {
      // Unreachable for typed callers; commands may come from untrusted input later.
      const { type } = command as { type?: unknown };
      return fail('UNKNOWN_COMMAND', `Unknown command type "${String(type)}"`);
    }
  }
}

function plantCrop(
  state: GameState,
  command: PlantCropCommand,
  content: GameContent,
): CommandResult {
  if (!isCrop(command.cropId, content)) {
    return fail('UNKNOWN_CROP', `Unknown crop "${command.cropId}"`);
  }
  const found = findPlot(state, command.greenhouseId, command.plotId);
  if (!found.ok) return found;
  const { greenhouse, plot } = found;
  if (plot.planting) {
    return fail('PLOT_OCCUPIED', `Plot "${plot.id}" is not empty`);
  }
  const { seedCost } = content.crops[command.cropId];
  if (state.money < seedCost) {
    return fail('NOT_ENOUGH_MONEY', `Seeds cost ${seedCost}`);
  }

  const planted = updatePlot(state, greenhouse.id, {
    ...plot,
    planting: {
      status: 'growing',
      cropId: command.cropId,
      plantedAtHour: state.clock.gameHour,
      growthHours: 0,
      stress: 0,
    },
  });
  return { ok: true, state: { ...planted, money: state.money - seedCost } };
}

function topUp(
  state: GameState,
  greenhouseId: string,
  resource: 'water' | 'nutrients',
  content: GameContent,
): CommandResult {
  const found = findGreenhouse(state, greenhouseId);
  if (!found.ok) return found;
  const { greenhouse } = found;
  const { amount, cost, max } = content.care[resource];
  const current = greenhouse.climate[resource];
  if (current >= max) {
    return fail('ALREADY_FULL', `The ${resource} is already at ${max}`);
  }
  if (state.money < cost) {
    return fail('NOT_ENOUGH_MONEY', `Topping up ${resource} costs ${cost}`);
  }

  const climate = {
    ...greenhouse.climate,
    [resource]: Math.min(max, current + amount),
  };
  return {
    ok: true,
    state: {
      ...updateGreenhouse(state, { ...greenhouse, climate }),
      money: state.money - cost,
    },
  };
}

function harvestCrop(
  state: GameState,
  command: HarvestCropCommand,
  content: GameContent,
): CommandResult {
  const found = findPlot(state, command.greenhouseId, command.plotId);
  if (!found.ok) return found;
  const { greenhouse, plot } = found;
  const { planting } = plot;
  if (!planting) return fail('PLOT_EMPTY', `Plot "${plot.id}" is empty`);
  if (planting.status !== 'ready') {
    return fail('NOT_READY', `Plot "${plot.id}" is still growing`);
  }
  const free = content.storage.capacity - storedUnits(state.storage);
  if (planting.yieldUnits > free) {
    return fail(
      'STORAGE_FULL',
      `Storage has room for ${free}, the harvest is ${planting.yieldUnits}`,
    );
  }

  const rng = createRng(state.rng);
  const lot = {
    id: rng.uuid(),
    cropId: planting.cropId,
    units: planting.yieldUnits,
    quality: planting.quality,
    harvestedAtHour: state.clock.gameHour,
  };
  const picked = updatePlot(state, greenhouse.id, { ...plot, planting: null });
  return {
    ok: true,
    state: {
      ...picked,
      rng: rng.snapshot(),
      storage: { ...state.storage, lots: [...state.storage.lots, lot] },
    },
  };
}

function sellCrop(
  state: GameState,
  command: SellCropCommand,
  content: GameContent,
): CommandResult {
  const { cropId, units } = command;
  if (!isCrop(cropId, content)) {
    return fail('UNKNOWN_CROP', `Unknown crop "${cropId}"`);
  }
  if (!Number.isInteger(units) || units < 1) {
    return fail('INVALID_AMOUNT', `Cannot sell ${units} units`);
  }
  const stock = stockOf(state.storage, cropId);
  if (stock < units) {
    return fail('NOT_ENOUGH_STOCK', `Only ${stock} ${cropId} in storage`);
  }

  const { gameHour } = state.clock;
  const price = cropPrice(state.market, cropId, gameHour, content);
  const sale = sell(
    state.storage,
    cropId,
    units,
    price,
    gameHour,
    content.crops[cropId],
  );
  return {
    ok: true,
    state: {
      ...state,
      money: state.money + sale.revenue,
      storage: sale.storage,
    },
  };
}

// Commands may come from untrusted input later, so check ids at runtime too.
function isCrop(cropId: string, content: GameContent): boolean {
  return Object.hasOwn(content.crops, cropId);
}

type FoundPlot =
  | { readonly ok: true; readonly greenhouse: Greenhouse; readonly plot: Plot }
  | Failure;

function findPlot(
  state: GameState,
  greenhouseId: string,
  plotId: string,
): FoundPlot {
  const found = findGreenhouse(state, greenhouseId);
  if (!found.ok) return found;
  const { greenhouse } = found;
  const plot = greenhouse.plots.find((p) => p.id === plotId);
  if (!plot) return fail('PLOT_NOT_FOUND', `No plot "${plotId}"`);
  return { ok: true, greenhouse, plot };
}

function updatePlot(
  state: GameState,
  greenhouseId: string,
  plot: Plot,
): GameState {
  return {
    ...state,
    greenhouses: state.greenhouses.map((g) =>
      g.id === greenhouseId
        ? { ...g, plots: g.plots.map((p) => (p.id === plot.id ? plot : p)) }
        : g,
    ),
  };
}
