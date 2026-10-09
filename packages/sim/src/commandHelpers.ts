import type { CommandError, CommandErrorCode } from './commands';
import type { GameState, Greenhouse } from './state';

export interface Failure {
  readonly ok: false;
  readonly error: CommandError;
}

export function fail(code: CommandErrorCode, message: string): Failure {
  return { ok: false, error: { code, message } };
}

export function findGreenhouse(
  state: GameState,
  greenhouseId: string,
): { readonly ok: true; readonly greenhouse: Greenhouse } | Failure {
  const greenhouse = state.greenhouses.find((g) => g.id === greenhouseId);
  if (!greenhouse) {
    return fail('GREENHOUSE_NOT_FOUND', `No greenhouse "${greenhouseId}"`);
  }
  return { ok: true, greenhouse };
}

export function updateGreenhouse(
  state: GameState,
  greenhouse: Greenhouse,
): GameState {
  return {
    ...state,
    greenhouses: state.greenhouses.map((g) =>
      g.id === greenhouse.id ? greenhouse : g,
    ),
  };
}
