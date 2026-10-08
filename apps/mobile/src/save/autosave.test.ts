import { defaultContent } from '@voltiris/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFakeLifecycle,
  createTestStore,
  firstGreenhouseOf,
} from '../game/test-utils';
import { startAutosave } from './autosave';
import type { SaveFile } from './saveFile';
import { createMemorySaveStore, type SaveStore } from './SaveStore';

const MS_PER_TICK = defaultContent.time.realMsPerTick;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(saveStore: SaveStore = createMemorySaveStore()) {
  const { clock, store } = createTestStore();
  const hide = createFakeLifecycle();
  const onError = vi.fn();
  const autosave = startAutosave({
    store,
    saveStore,
    now: () => 42,
    lifecycle: hide.lifecycle,
    onError,
  });
  /** Moves the game on by one tick. */
  const tick = () => {
    clock.advance(MS_PER_TICK);
    store.getState().advance();
  };
  const saved = async () => (await saveStore.readAll()) as readonly SaveFile[];
  return { store, autosave, hide, onError, tick, saved };
}

describe('autosave', () => {
  it('saves right away when it starts', async () => {
    const { store, saved } = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(await saved()).toEqual([
      { format: 'voltiris-save', savedAt: 42, game: store.getState().game },
    ]);
  });

  it('saves every 30 seconds, but only when the game changed', async () => {
    const { tick, saved } = setup();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await saved()).toHaveLength(1);

    tick();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await saved()).toHaveLength(2);
  });

  it('saves straight after a player action', async () => {
    const { store, saved } = setup();
    await vi.advanceTimersByTimeAsync(0);
    const greenhouse = firstGreenhouseOf(store);
    store
      .getState()
      .plantCrop(greenhouse.id, greenhouse.plots[0]?.id ?? '', 'pepper');
    await vi.advanceTimersByTimeAsync(0);
    const [latest] = await saved();
    expect(latest?.game.greenhouses[0]?.plots[0]?.planting?.cropId).toBe(
      'pepper',
    );
  });

  it('saves when the app goes to the background', async () => {
    const { tick, hide, store, saved } = setup();
    await vi.advanceTimersByTimeAsync(0);
    tick();
    hide.hide();
    await vi.advanceTimersByTimeAsync(0);
    expect((await saved())[0]?.game).toEqual(store.getState().game);
  });

  it('writes one save at a time, and the last one has the latest game', async () => {
    const writes: SaveFile[] = [];
    let release = () => {};
    const slow: SaveStore = {
      write: (file) => {
        writes.push(file);
        return new Promise((resolve) => (release = resolve));
      },
      readAll: () => Promise.resolve(writes),
    };
    const { autosave, tick, store } = setup(slow);
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toHaveLength(1);

    // Three requests while the first write is still running…
    for (let k = 0; k < 3; k++) {
      tick();
      void autosave.saveNow();
    }
    expect(writes).toHaveLength(1);

    // …share a single follow-up write of the newest game.
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toHaveLength(2);
    expect(writes[1]?.game).toBe(store.getState().game);
    release();
  });

  it('reports a failing save once, until saving works again', async () => {
    let fail = true;
    const memory = createMemorySaveStore();
    const flaky: SaveStore = {
      write: (file) =>
        fail ? Promise.reject(new Error('disk full')) : memory.write(file),
      readAll: () => memory.readAll(),
    };
    const { onError, tick, autosave } = setup(flaky);
    tick();
    await autosave.saveNow();
    tick();
    await autosave.saveNow();
    expect(onError).toHaveBeenCalledTimes(1);

    fail = false;
    tick();
    await autosave.saveNow();
    fail = true;
    tick();
    await autosave.saveNow();
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('stops saving when stopped', async () => {
    const { autosave, tick, hide, saved } = setup();
    await vi.advanceTimersByTimeAsync(0);
    autosave.stop();
    tick();
    hide.hide();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await saved()).toHaveLength(1);
  });
});
