import { defaultContent } from '@voltiris/content';
import { STATE_VERSION } from '@voltiris/sim';
import { describe, expect, it } from 'vitest';
import { createTestStore } from '../game/test-utils';
import { loadGame } from './loadGame';
import { readSaveText, saveFileToText, toSaveFile } from './saveFile';
import { createMemorySaveStore, type SaveStore } from './SaveStore';

const game = createTestStore(1).store.getState().game;
const older = createTestStore(2).store.getState().game;
const good = toSaveFile(game, 1);
const damaged = { ...good, game: { ...game, money: 'lots' } };

describe('loadGame', () => {
  it('is empty when nothing was saved yet', async () => {
    expect(await loadGame(createMemorySaveStore(), defaultContent)).toEqual({
      kind: 'empty',
    });
  });

  it('loads the current save', async () => {
    const store = createMemorySaveStore([good, toSaveFile(older, 0)]);
    expect(await loadGame(store, defaultContent)).toEqual({
      kind: 'loaded',
      game,
      fromBackup: false,
    });
  });

  it('falls back to a backup when the current save is damaged', async () => {
    const store = createMemorySaveStore([
      damaged,
      'junk',
      toSaveFile(older, 0),
    ]);
    expect(await loadGame(store, defaultContent)).toEqual({
      kind: 'loaded',
      game: older,
      fromBackup: true,
    });
  });

  it('fails, keeping the damaged save, when nothing can be read', async () => {
    const store = createMemorySaveStore([damaged, 'junk']);
    expect(await loadGame(store, defaultContent)).toEqual({
      kind: 'failed',
      error: { code: 'INVALID', message: 'money should be a number' },
      raw: damaged,
    });
  });

  it('never swaps a save from a newer version for an older backup', async () => {
    const newer = { ...good, game: { ...game, version: 99 } };
    const store = createMemorySaveStore([newer, toSaveFile(older, 0)]);
    expect(await loadGame(store, defaultContent)).toMatchObject({
      kind: 'failed',
      error: { code: 'TOO_NEW' },
      raw: newer,
    });
  });

  it('reports storage that cannot be read', async () => {
    const broken: SaveStore = {
      write: () => Promise.resolve(),
      readAll: () => Promise.reject(new Error('IndexedDB is blocked')),
    };
    expect(await loadGame(broken, defaultContent)).toMatchObject({
      kind: 'failed',
      error: { code: 'STORAGE_ERROR', message: 'Error: IndexedDB is blocked' },
    });
  });
});

describe('save text', () => {
  it('round-trips a game through export and import', () => {
    expect(readSaveText(saveFileToText(good), defaultContent)).toEqual({
      ok: true,
      state: game,
      fromVersion: STATE_VERSION,
    });
  });

  it.each([
    ['text that is not JSON', 'hello'],
    ['JSON that is not a save', '{"money": 5}'],
    ['a bare game without the save wrapper', JSON.stringify(game)],
  ])('rejects %s', (_what, text) => {
    expect(readSaveText(text, defaultContent)).toMatchObject({
      ok: false,
      error: { code: 'NOT_A_SAVE' },
    });
  });
});
