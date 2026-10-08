import Dexie, { type DexieOptions, type EntityTable } from 'dexie';
import { BACKUP_COUNT, type SaveStore } from './SaveStore';

interface SaveRecord {
  /** 0 is the current save, 1 to BACKUP_COUNT the backups, newest first. */
  readonly slot: number;
  readonly file: unknown;
}

type SaveDatabase = Dexie & { saves: EntityTable<SaveRecord, 'slot'> };

/** Saves in the device's IndexedDB, through Dexie. */
export function createIndexedDbSaveStore(
  name = 'voltiris',
  options?: DexieOptions,
): SaveStore {
  const db = new Dexie(name, options) as SaveDatabase;
  db.version(1).stores({ saves: 'slot' });

  return {
    async write(file) {
      // One transaction, so a crash never leaves the slots half shifted.
      await db.transaction('rw', db.saves, async () => {
        const slots = Array.from({ length: BACKUP_COUNT }, (_, k) => k);
        const older = await db.saves.bulkGet(slots);
        await db.saves.bulkPut([
          { slot: 0, file },
          ...older.flatMap((record, k) =>
            record ? [{ slot: k + 1, file: record.file }] : [],
          ),
        ]);
      });
    },

    async readAll() {
      const records = await db.saves.orderBy('slot').toArray();
      return records.map((record) => record.file);
    },
  };
}
