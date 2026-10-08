import { defaultContent } from '@voltiris/content';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createTestStore } from '../game/test-utils';
import { createFileSaveStore, type SaveFiles } from './fileSaveStore';
import { createIndexedDbSaveStore } from './indexedDbSaveStore';
import { loadGame } from './loadGame';
import { toSaveFile } from './saveFile';
import { createMemorySaveStore, type SaveStore } from './SaveStore';

/**
 * Files in memory. With `dieAfter`, the "app" is killed after that many
 * file operations: the next one throws and nothing more is written.
 */
function memoryFiles(disk = new Map<string, string>(), dieAfter = Infinity) {
  let operations = 0;
  const step = () => {
    if (operations++ >= dieAfter) throw new Error('app killed');
  };
  const files: SaveFiles = {
    read: (name) => Promise.resolve(disk.get(name) ?? null),
    write: (name, text) => {
      step();
      disk.set(name, text);
      return Promise.resolve();
    },
    move: (from, to) => {
      step();
      const text = disk.get(from);
      if (text !== undefined) {
        disk.set(to, text);
        disk.delete(from);
      }
      return Promise.resolve();
    },
    remove: (name) => {
      step();
      disk.delete(name);
      return Promise.resolve();
    },
  };
  return files;
}

const stores: [string, () => SaveStore][] = [
  ['memory', () => createMemorySaveStore()],
  [
    'IndexedDB',
    () =>
      createIndexedDbSaveStore('test', {
        indexedDB: new IDBFactory(),
        IDBKeyRange,
      }),
  ],
  ['file', () => createFileSaveStore(memoryFiles())],
];

function saveAt(savedAt: number) {
  return toSaveFile(createTestStore().store.getState().game, savedAt);
}

describe.each(stores)('%s save store', (_name, create) => {
  it('starts empty', async () => {
    expect(await create().readAll()).toEqual([]);
  });

  it('returns the current save first, then the backups', async () => {
    const store = create();
    await store.write(saveAt(1));
    await store.write(saveAt(2));
    expect(await store.readAll()).toEqual([saveAt(2), saveAt(1)]);
  });

  it('keeps the last two saves as backups and drops older ones', async () => {
    const store = create();
    for (const t of [1, 2, 3, 4, 5]) await store.write(saveAt(t));
    const files = (await store.readAll()) as { savedAt: number }[];
    expect(files.map((f) => f.savedAt)).toEqual([5, 4, 3]);
  });

  it('stores a copy, not the live object', async () => {
    const store = create();
    const file = saveAt(1);
    await store.write(file);
    const [stored] = await store.readAll();
    expect(stored).toEqual(file);
    expect(stored).not.toBe(file);
  });
});

describe('file save store', () => {
  /** Saves 1 and 2, then save 3 with the app killed after `steps` file operations. */
  async function killedDuringThirdSave(steps: number) {
    const disk = new Map<string, string>();
    const healthy = createFileSaveStore(memoryFiles(disk));
    await healthy.write(saveAt(1));
    await healthy.write(saveAt(2));
    const dying = createFileSaveStore(memoryFiles(disk, steps));
    await expect(dying.write(saveAt(3))).rejects.toThrow('app killed');
    return createFileSaveStore(memoryFiles(disk));
  }

  it.each([0, 1, 2, 3, 4])(
    'still loads a complete save if the app dies after %i steps of saving',
    async (steps) => {
      const store = await killedDuringThirdSave(steps);
      const loaded = await loadGame(store, defaultContent);
      expect(loaded.kind).toBe('loaded');
      const [newest] = (await store.readAll()) as { savedAt: number }[];
      // Before the new save is fully written, the last good one is newest.
      expect(newest?.savedAt).toBe(steps === 0 ? 2 : 3);
    },
  );

  it('picks up cleanly on the next save after a crash', async () => {
    const store = await killedDuringThirdSave(2);
    await store.write(saveAt(4));
    const files = (await store.readAll()) as { savedAt: number }[];
    expect(files.map((f) => f.savedAt)).toEqual([4, 3, 2]);
  });

  it('hands back a damaged file as is, so loading falls back to a backup', async () => {
    const disk = new Map<string, string>();
    const store = createFileSaveStore(memoryFiles(disk));
    await store.write(saveAt(1));
    await store.write(saveAt(2));
    disk.set('save-0.json', '{"format": "voltiris-sa');
    expect((await store.readAll())[0]).toBe('{"format": "voltiris-sa');
    expect(await loadGame(store, defaultContent)).toMatchObject({
      kind: 'loaded',
      fromBackup: true,
    });
  });
});

describe('IndexedDB save store', () => {
  it('keeps saves across reopening the database', async () => {
    const options = { indexedDB: new IDBFactory(), IDBKeyRange };
    await createIndexedDbSaveStore('game', options).write(saveAt(1));
    const reopened = createIndexedDbSaveStore('game', options);
    expect(await reopened.readAll()).toEqual([saveAt(1)]);
  });
});
