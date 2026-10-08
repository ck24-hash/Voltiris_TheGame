import type { GameContent } from '@voltiris/content';
import { restoreGame, type GameState, type RestoreResult } from '@voltiris/sim';

const SAVE_FORMAT = 'voltiris-save';

/** What gets stored and exported: the game plus a little metadata. */
export interface SaveFile {
  readonly format: typeof SAVE_FORMAT;
  /** Device time (ms) when it was saved; for information only. */
  readonly savedAt: number;
  readonly game: GameState;
}

export function toSaveFile(game: GameState, savedAt: number): SaveFile {
  return { format: SAVE_FORMAT, savedAt, game };
}

/** Checks stored or imported data and restores the game in it. */
export function readSaveFile(
  raw: unknown,
  content: GameContent,
): RestoreResult {
  const isSaveFile =
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { format?: unknown }).format === SAVE_FORMAT;
  if (!isSaveFile) {
    return {
      ok: false,
      error: { code: 'NOT_A_SAVE', message: 'This is not a Voltiris save' },
    };
  }
  return restoreGame((raw as { game?: unknown }).game, content);
}

/** Save files are plain JSON, so they can be exported, read and imported. */
export function saveFileToText(file: SaveFile): string {
  return JSON.stringify(file, null, 2);
}

export function readSaveText(
  text: string,
  content: GameContent,
): RestoreResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: { code: 'NOT_A_SAVE', message: 'This is not a Voltiris save' },
    };
  }
  return readSaveFile(raw, content);
}
