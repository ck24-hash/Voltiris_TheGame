// Helpers for sim tests. Not exported from the package.

import {
  CLIMATE_VARIABLES,
  defaultContent,
  type Climate,
  type CropId,
  type EquipmentKind,
  type GameContent,
  type Setpoints,
} from '@voltiris/content';
import { createManualClock } from './clock';
import { applyCommand, type Command } from './commands';
import { createGame } from './newGame';
import type { GameState, Greenhouse, Planting } from './state';
import { tick } from './tick';

export const TEST_PLAYER_ID = '00000000-0000-4000-8000-000000000000';

/**
 * The game's content, except that the air keeps whatever climate it has:
 * for tests of growth in a climate set by hand. Water still gets used up.
 */
export const STILL_AIR: GameContent = {
  ...defaultContent,
  physics: {
    ...defaultContent.physics,
    settle: { temperature: 0, humidity: 0, co2: 0, light: 0 },
  },
};

export function newTestGame(
  seed = 42,
  content: GameContent = defaultContent,
): GameState {
  return createGame(
    { playerId: TEST_PLAYER_ID, seed },
    content,
    createManualClock(0),
  );
}

/** Climate at the middle of every optimal band for the crop. */
export function optimalClimate(
  cropId: CropId,
  content: GameContent = defaultContent,
): Climate {
  const bands = content.crops[cropId].climate;
  const entries = CLIMATE_VARIABLES.map((v) => [
    v,
    (bands[v].optimalLow + bands[v].optimalHigh) / 2,
  ]);
  return Object.fromEntries(entries) as Climate;
}

export function firstGreenhouse(state: GameState): Greenhouse {
  const greenhouse = state.greenhouses[0];
  if (!greenhouse) throw new Error('Game has no greenhouse');
  return greenhouse;
}

/** Changes the first greenhouse directly. */
export function withGreenhouse(
  state: GameState,
  change: (greenhouse: Greenhouse) => Partial<Greenhouse>,
): GameState {
  const [first, ...rest] = state.greenhouses;
  if (!first) throw new Error('Game has no greenhouse');
  return { ...state, greenhouses: [{ ...first, ...change(first) }, ...rest] };
}

/**
 * Sets the first greenhouse's climate directly. Unless the content is
 * STILL_AIR, the air then moves on toward its balance.
 */
export function withClimate(
  state: GameState,
  climate: Partial<Climate>,
): GameState {
  return withGreenhouse(state, (g) => ({
    climate: { ...g.climate, ...climate },
  }));
}

/**
 * A game with money to spare, the first greenhouse fitted with `kinds` (one
 * level each) and some setpoints changed.
 */
export function equipped(
  kinds: readonly EquipmentKind[],
  setpoints: Partial<Setpoints> = {},
  start: GameState = newTestGame(),
): GameState {
  let state: GameState = { ...start, money: 100_000 };
  for (const kind of kinds) state = buy(state, kind);
  return withGreenhouse(state, (g) => ({
    setpoints: { ...g.setpoints, ...setpoints },
  }));
}

/** Sets the energy system directly. */
export function withEnergy(
  state: GameState,
  change: Partial<GameState['energy']>,
): GameState {
  return { ...state, energy: { ...state.energy, ...change } };
}

/** Buys (or upgrades) a device for the first greenhouse; throws if refused. */
export function buy(
  state: GameState,
  kind: EquipmentKind,
  content: GameContent = defaultContent,
): GameState {
  return accept(
    state,
    {
      type: 'BuyEquipment',
      id: `cmd-buy-${kind}`,
      issuedAt: 0,
      greenhouseId: firstGreenhouse(state).id,
      kind,
    },
    content,
  );
}

/** Applies a command; throws if it is rejected. */
export function accept(
  state: GameState,
  command: Command,
  content: GameContent = defaultContent,
): GameState {
  const result = applyCommand(state, command, content);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function plotId(state: GameState, plotIndex: number): string {
  const plot = firstGreenhouse(state).plots[plotIndex];
  if (!plot) throw new Error(`No plot at index ${plotIndex}`);
  return plot.id;
}

/** Plants a crop in the first greenhouse; throws if the command is rejected. */
export function plant(
  state: GameState,
  cropId: CropId,
  plotIndex = 0,
  content: GameContent = defaultContent,
): GameState {
  return accept(
    state,
    {
      type: 'PlantCrop',
      id: `cmd-plant-${plotIndex}`,
      issuedAt: 0,
      greenhouseId: firstGreenhouse(state).id,
      plotId: plotId(state, plotIndex),
      cropId,
    },
    content,
  );
}

/** Harvests a ready plot of the first greenhouse into storage. */
export function harvest(
  state: GameState,
  plotIndex = 0,
  content: GameContent = defaultContent,
): GameState {
  return accept(
    state,
    {
      type: 'HarvestCrop',
      id: `cmd-harvest-${plotIndex}`,
      issuedAt: 0,
      greenhouseId: firstGreenhouse(state).id,
      plotId: plotId(state, plotIndex),
    },
    content,
  );
}

export function runTicks(
  state: GameState,
  count: number,
  content: GameContent = defaultContent,
): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = tick(next, content);
  return next;
}

export function plantingAt(state: GameState, plotIndex = 0): Planting | null {
  return firstGreenhouse(state).plots[plotIndex]?.planting ?? null;
}

export interface GrownCrop {
  readonly state: GameState;
  /** Ticks from planting until the crops were ready. */
  readonly ticks: number;
  readonly quality: number;
  /** Volticoins spent on watering by hand. */
  readonly careCost: number;
}

/**
 * Plants every plot of the first greenhouse with one crop and runs the game
 * until they are ready, watering by hand whenever the crop's gauge says it
 * needs it (unless `byHand` is false).
 */
export function growCrop(
  state: GameState,
  cropId: CropId,
  {
    content = defaultContent,
    byHand = true,
    limit = 5000,
  }: { content?: GameContent; byHand?: boolean; limit?: number } = {},
): GrownCrop {
  let next = state;
  firstGreenhouse(state).plots.forEach((_, k) => {
    next = plant(next, cropId, k, content);
  });
  const greenhouseId = firstGreenhouse(next).id;
  const waterLow = content.crops[cropId].climate.water.optimalLow;
  let careCost = 0;
  for (let ticks = 1; ticks <= limit; ticks++) {
    next = tick(next, content);
    const planting = plantingAt(next);
    if (planting?.status === 'ready') {
      return { state: next, ticks, quality: planting.quality, careCost };
    }
    if (!byHand) continue;
    if (firstGreenhouse(next).climate.water < waterLow) {
      next = accept(
        next,
        { type: 'Water', id: 'cmd-water', issuedAt: 0, greenhouseId },
        content,
      );
      careCost += content.care.water.cost;
    }
  }
  throw new Error(`The ${cropId} was not ready within ${limit} ticks`);
}

/** Freezes a value recursively, so any mutation in the code under test throws. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
