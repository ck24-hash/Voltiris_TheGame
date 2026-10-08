import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { BACKUP_COUNT, type SaveStore } from './SaveStore';

/**
 * The file operations the store needs: Capacitor's Filesystem on a phone, a
 * fake in tests. The store only touches files `list` returns (asking the
 * phone about a missing file logs an error), and never renames onto one.
 */
export interface SaveFiles {
  /** Names of the save files there are. */
  list(): Promise<string[]>;
  read(name: string): Promise<string>;
  write(name: string, text: string): Promise<void>;
  /** Renames a file; `to` must not exist (iOS will not replace it). */
  move(from: string, to: string): Promise<void>;
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
  const present = async () => new Set(await files.list());

  /** Shifts the backups down and makes the next save the current one. */
  const shiftIn = async (names: ReadonlySet<string>) => {
    if (names.has(slot(BACKUP_COUNT))) await files.remove(slot(BACKUP_COUNT));
    // From the oldest down, so each slot is empty before a file moves in.
    for (let k = BACKUP_COUNT - 1; k >= 0; k--) {
      if (names.has(slot(k))) await files.move(slot(k), slot(k + 1));
    }
    await files.move(NEXT, slot(0));
  };

  return {
    async write(file) {
      // Finish a save the app died in the middle of, so it is kept.
      const before = await present();
      if (before.has(NEXT)) await shiftIn(before);
      await files.write(NEXT, JSON.stringify(file));
      await shiftIn(await present());
    },

    async readAll() {
      // A leftover next save means the app died mid-way: it is the newest.
      const names = await present();
      const order = [
        NEXT,
        ...Array.from({ length: 1 + BACKUP_COUNT }, (_, k) => slot(k)),
      ].filter((name) => names.has(name));
      const texts = await Promise.all(order.map((name) => files.read(name)));
      return texts.map(parseJson);
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
  // Listing a missing folder is an error too: look for it until it exists.
  let folderExists = false;

  return {
    list: async () => {
      if (!folderExists) {
        const { files } = await Filesystem.readdir({ path: '', directory });
        folderExists = files.some(
          (f) => f.name === folder && f.type === 'directory',
        );
        if (!folderExists) return [];
      }
      const { files } = await Filesystem.readdir({ path: folder, directory });
      return files.map((f) => f.name);
    },
    read: async (name) => {
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
      await Filesystem.rename({
        from: path(from),
        to: path(to),
        directory,
        toDirectory: directory,
      });
    },
    remove: async (name) => {
      await Filesystem.deleteFile({ path: path(name), directory });
    },
  };
}
