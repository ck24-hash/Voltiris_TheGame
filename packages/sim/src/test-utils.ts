// Helpers for sim tests. Not exported from the package.

import {
  CLIMATE_VARIABLES,
  defaultContent,
  type Climate,
  type CropId,
  type GameContent,
} from '@voltiris/content';
import { createManualClock } from './clock';
import { applyCommand, type Command } from './commands';
import { createGame } from './newGame';
import type { GameState, Greenhouse, Planting } from './state';
import { tick } from './tick';

export const TEST_PLAYER_ID = '00000000-0000-4000-8000-000000000000';

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

/** Sets the first greenhouse's climate directly (no equipment exists yet). */
export function withClimate(
  state: GameState,
  climate: Partial<Climate>,
): GameState {
  const [first, ...rest] = state.greenhouses;
  if (!first) throw new Error('Game has no greenhouse');
  return {
    ...state,
    greenhouses: [
      { ...first, climate: { ...first.climate, ...climate } },
      ...rest,
    ],
  };
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

/** Freezes a value recursively, so any mutation in the code under test throws. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
