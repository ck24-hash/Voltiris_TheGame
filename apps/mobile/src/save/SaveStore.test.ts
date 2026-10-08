import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createTestStore } from '../game/test-utils';
import { createIndexedDbSaveStore } from './indexedDbSaveStore';
import { toSaveFile } from './saveFile';
import { createMemorySaveStore, type SaveStore } from './SaveStore';

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

describe('IndexedDB save store', () => {
  it('keeps saves across reopening the database', async () => {
    const options = { indexedDB: new IDBFactory(), IDBKeyRange };
    await createIndexedDbSaveStore('game', options).write(saveAt(1));
    const reopened = createIndexedDbSaveStore('game', options);
    expect(await reopened.readAll()).toEqual([saveAt(1)]);
  });
});
