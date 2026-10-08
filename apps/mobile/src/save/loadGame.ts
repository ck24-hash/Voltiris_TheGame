import type { GameContent } from '@voltiris/content';
import type { GameState, RestoreErrorCode } from '@voltiris/sim';
import { readSaveFile } from './saveFile';
import type { SaveStore } from './SaveStore';

export interface LoadError {
  readonly code: RestoreErrorCode | 'STORAGE_ERROR';
  readonly message: string;
}

export type LoadResult =
  /** Nothing saved yet: start a new game. */
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'loaded';
      readonly game: GameState;
      /** The current save was damaged and a backup was used. */
      readonly fromBackup: boolean;
    }
  | {
      readonly kind: 'failed';
      readonly error: LoadError;
      /** The newest stored save as it is, so it can still be exported. */
      readonly raw: unknown;
    };

/**
 * Loads the current save, falling back to the backups if it is damaged. A
 * save from a newer version of the game is never replaced by an older backup.
 */
export async function loadGame(
  store: SaveStore,
  content: GameContent,
): Promise<LoadResult> {
  let files: readonly unknown[];
  try {
    files = await store.readAll();
  } catch (error) {
    return {
      kind: 'failed',
      error: { code: 'STORAGE_ERROR', message: String(error) },
      raw: undefined,
    };
  }
  if (files.length === 0) return { kind: 'empty' };

  let firstError: LoadError | null = null;
  for (const [index, raw] of files.entries()) {
    const result = readSaveFile(raw, content);
    if (result.ok) {
      return { kind: 'loaded', game: result.state, fromBackup: index > 0 };
    }
    if (result.error.code === 'TOO_NEW') {
      return { kind: 'failed', error: result.error, raw };
    }
    firstError ??= result.error;
  }
  return {
    kind: 'failed',
    error: firstError ?? { code: 'INVALID', message: 'No readable save' },
    raw: files[0],
  };
}
