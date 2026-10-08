import type { CropId, GameContent } from '@voltiris/content';
import type { GameState, Plot } from './state';

export interface CommandMeta {
  /** UUID, so commands can later be sent to and validated by a server. */
  readonly id: string;
  /** Real time (ms) at which the player issued the command. */
  readonly issuedAt: number;
}

export interface PlantCropCommand extends CommandMeta {
  readonly type: 'PlantCrop';
  readonly greenhouseId: string;
  readonly plotId: string;
  readonly cropId: CropId;
}

export type Command = PlantCropCommand;

export type CommandErrorCode =
  'GREENHOUSE_NOT_FOUND' | 'PLOT_NOT_FOUND' | 'PLOT_OCCUPIED' | 'UNKNOWN_CROP';

export interface CommandError {
  readonly code: CommandErrorCode;
  readonly message: string;
}

export type CommandResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: CommandError };

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
  }
}

function plantCrop(
  state: GameState,
  command: PlantCropCommand,
  content: GameContent,
): CommandResult {
  // Commands may come from untrusted input later, so check ids at runtime too.
  if (!Object.hasOwn(content.crops, command.cropId)) {
    return fail('UNKNOWN_CROP', `Unknown crop "${command.cropId}"`);
  }
  const greenhouse = state.greenhouses.find(
    (g) => g.id === command.greenhouseId,
  );
  if (!greenhouse) {
    return fail(
      'GREENHOUSE_NOT_FOUND',
      `No greenhouse "${command.greenhouseId}"`,
    );
  }
  const plot = greenhouse.plots.find((p) => p.id === command.plotId);
  if (!plot) {
    return fail('PLOT_NOT_FOUND', `No plot "${command.plotId}"`);
  }
  if (plot.planting) {
    return fail('PLOT_OCCUPIED', `Plot "${command.plotId}" is not empty`);
  }

  return {
    ok: true,
    state: updatePlot(state, greenhouse.id, plot.id, {
      ...plot,
      planting: {
        status: 'growing',
        cropId: command.cropId,
        plantedAtHour: state.clock.gameHour,
        growthHours: 0,
        stress: 0,
      },
    }),
  };
}

function fail(code: CommandErrorCode, message: string): CommandResult {
  return { ok: false, error: { code, message } };
}

function updatePlot(
  state: GameState,
  greenhouseId: string,
  plotId: string,
  plot: Plot,
): GameState {
  return {
    ...state,
    greenhouses: state.greenhouses.map((g) =>
      g.id === greenhouseId
        ? { ...g, plots: g.plots.map((p) => (p.id === plotId ? plot : p)) }
        : g,
    ),
  };
}
