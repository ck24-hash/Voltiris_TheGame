import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { BACKUP_COUNT, type SaveStore } from './SaveStore';

/** The file operations the store needs: Capacitor's Filesystem on a phone, a fake in tests. */
export interface SaveFiles {
  /** The file's text, or null if there is no such file. */
  read(name: string): Promise<string | null>;
  write(name: string, text: string): Promise<void>;
  /** Renames a file, replacing `to`; does nothing if `from` is missing. */
  move(from: string, to: string): Promise<void>;
  /** Deletes a file; does nothing if it is missing. */
  remove(name: string): Promise<void>;
}

/** The newest save, until the backups have shifted and it becomes slot 0. */
const NEXT = 'save-next.json';
const slot = (k: number) => `save-${k}.json`;

/**
 * Saves as files in the app's own storage, which the phone never clears
 * (iOS may clear web storage when space runs low) and which device backups
 * include. A new save is written in full before the older ones shift, so a
 * crash at any point still leaves a complete save behind.
 */
export function createFileSaveStore(files: SaveFiles): SaveStore {
  /** Shifts the backups down and makes the next save the current one. */
  const shiftIn = async () => {
    await files.remove(slot(BACKUP_COUNT));
    for (let k = BACKUP_COUNT - 1; k >= 0; k--) {
      await files.move(slot(k), slot(k + 1));
    }
    await files.move(NEXT, slot(0));
  };

  return {
    async write(file) {
      // Finish a save the app died in the middle of, so it is kept.
      if ((await files.read(NEXT)) !== null) await shiftIn();
      await files.write(NEXT, JSON.stringify(file));
      await shiftIn();
    },

    async readAll() {
      // A leftover next save means the app died mid-way: it is the newest.
      const names = [
        NEXT,
        ...Array.from({ length: 1 + BACKUP_COUNT }, (_, k) => slot(k)),
      ];
      const texts = await Promise.all(names.map((name) => files.read(name)));
      return texts.flatMap((text) => (text === null ? [] : [parseJson(text)]));
    },
  };
}

/** Damaged JSON comes back as its text, so loading skips it like any bad save. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Save files in the app's Library folder (iOS) or files folder (Android). */
export function capacitorSaveFiles(folder = 'saves'): SaveFiles {
  const directory = Directory.Library;
  const path = (name: string) => `${folder}/${name}`;
  const exists = async (name: string) => {
    try {
      await Filesystem.stat({ path: path(name), directory });
      return true;
    } catch {
      return false;
    }
  };
  const remove = async (name: string) => {
    if (await exists(name)) {
      await Filesystem.deleteFile({ path: path(name), directory });
    }
  };

  return {
    read: async (name) => {
      if (!(await exists(name))) return null;
      const { data } = await Filesystem.readFile({
        path: path(name),
        directory,
        encoding: Encoding.UTF8,
      });
      return typeof data === 'string' ? data : data.text();
    },
    write: async (name, text) => {
      await Filesystem.writeFile({
        path: path(name),
        data: text,
        directory,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    },
    move: async (from, to) => {
      if (!(await exists(from))) return;
      // iOS will not rename onto an existing file.
      await remove(to);
      await Filesystem.rename({
        from: path(from),
        to: path(to),
        directory,
        toDirectory: directory,
      });
    },
    remove,
  };
}
