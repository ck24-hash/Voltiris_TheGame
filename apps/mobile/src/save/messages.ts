import type { ExportMethod } from '../game/services';
import type { LoadError } from './loadGame';

/** What to tell the player after an export; nothing if they closed the share sheet. */
export const EXPORT_MESSAGES: Record<ExportMethod, string | null> = {
  downloaded: 'Save file downloaded',
  shared: 'Save shared',
  cancelled: null,
};

/** What went wrong with a save, in words for the player. */
export function describeLoadError(error: LoadError): string {
  switch (error.code) {
    case 'TOO_NEW':
      return 'This save comes from a newer version of the game. Update the game to play it.';
    case 'NOT_A_SAVE':
      return 'This is not a Voltiris save.';
    case 'STORAGE_ERROR':
      return 'The game could not read its saves on this device.';
    case 'NO_MIGRATION':
    case 'INVALID':
      return `This save is damaged and cannot be loaded (${error.message}).`;
  }
}
