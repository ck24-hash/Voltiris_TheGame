import type { SaveFile } from './saveFile';

/** Older saves kept next to the current one, in case it gets damaged. */
export const BACKUP_COUNT = 2;

/**
 * Where saves live. The game only persists through this interface: IndexedDB
 * on the device now, a cloud save later.
 */
export interface SaveStore {
  /** Stores a save; the previous saves become backups (BACKUP_COUNT kept). */
  write(file: SaveFile): Promise<void>;
  /**
   * Everything stored, newest first: the current save, then the backups. The
   * data is unchecked; read each one with readSaveFile.
   */
  readAll(): Promise<readonly unknown[]>;
}

/** Keeps saves in memory; for tests, and when the device has no storage. */
export function createMemorySaveStore(
  initial: readonly unknown[] = [],
): SaveStore {
  let files = structuredClone([...initial]);
  return {
    write: (file) => {
      files = [structuredClone(file), ...files].slice(0, 1 + BACKUP_COUNT);
      return Promise.resolve();
    },
    readAll: () => Promise.resolve(structuredClone(files)),
  };
}
