import { defaultContent } from '@voltiris/content';
import { createGame, type Clock, type GameState } from '@voltiris/sim';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameStore, startGameLoop } from '../game/store';
import { createFakeLifecycle } from '../game/test-utils';
import { startAutosave } from './autosave';
import { createIndexedDbSaveStore } from './indexedDbSaveStore';
import { loadGame } from './loadGame';

// Done when (Phase 4): closing and reopening the app after 2 hours restores
// the game and fast-forwards it correctly.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const content = defaultContent;

afterEach(() => {
  vi.useRealTimers();
});

function storeFor(game: GameState, clock: Clock) {
  let id = 0;
  return createGameStore({ content, clock, newId: () => `cmd-${++id}`, game });
}

describe('closing and reopening the app', () => {
  it('restores the game after 2 hours and fast-forwards it like it never closed', async () => {
    // Fake intervals and Date drive the game loop and clock; IndexedDB keeps
    // its real (async) timers.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(1_767_225_600_000);
    const clock: Clock = { now: () => Date.now() };
    const db = { indexedDB: new IDBFactory(), IDBKeyRange };
    const app = createFakeLifecycle();

    // Session 1: buy a heater, plant a tomato and microgreens, play for 10
    // minutes and harvest the microgreens.
    const first = storeFor(
      createGame({ playerId: 'player', seed: 3 }, content, clock),
      clock,
    );
    const stopLoop = startGameLoop(first, { lifecycle: app.lifecycle });
    const autosave = startAutosave({
      store: first,
      saveStore: createIndexedDbSaveStore('voltiris', db),
      now: () => clock.now(),
      lifecycle: app.lifecycle,
    });
    const greenhouseId = first.getState().game.greenhouses[0]?.id ?? '';
    const [tomato, greens] = first.getState().game.greenhouses[0]?.plots ?? [];
    const { buyEquipment, plantCrop, harvestCrop } = first.getState();
    expect(buyEquipment(greenhouseId, 'heater')).toBeNull();
    expect(plantCrop(greenhouseId, tomato?.id ?? '', 'tomato')).toBeNull();
    expect(plantCrop(greenhouseId, greens?.id ?? '', 'microgreens')).toBeNull();
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(harvestCrop(greenhouseId, greens?.id ?? '')).toBeNull();

    // The player leaves: the app is hidden, saves, and is closed.
    app.hide();
    await autosave.saveNow();
    autosave.stop();
    stopLoop();
    const closedGame = first.getState().game;
    expect(closedGame.clock.gameHour).toBe(40);

    // For comparison, a copy of the game that stays open the whole time.
    const twin = storeFor(closedGame, clock);
    const stopTwin = startGameLoop(twin, {
      lifecycle: createFakeLifecycle().lifecycle,
    });
    await vi.advanceTimersByTimeAsync(2 * HOUR);
    stopTwin();

    // Session 2, two hours later: load the save and catch up.
    const loaded = await loadGame(
      createIndexedDbSaveStore('voltiris', db),
      content,
    );
    if (loaded.kind !== 'loaded') throw new Error(`load ${loaded.kind}`);
    expect(loaded.fromBackup).toBe(false);
    const second = storeFor(loaded.game, clock);
    second.getState().advance();

    const { game, away } = second.getState();
    expect(game).toEqual(twin.getState().game);
    expect(game.clock.gameHour).toBe(40 + 480);
    // The heater kept running and was paid for.
    expect(game.money).toBeLessThan(closedGame.money);
    // The tomato ripened while the player was away; the microgreens left in
    // storage went off.
    const ripe = game.greenhouses[0]?.plots[0]?.planting;
    if (ripe?.status !== 'ready') throw new Error('expected a ripe tomato');
    expect(ripe.readyAtHour).toBeGreaterThan(40);
    expect(away).toEqual({
      awayMs: 2 * HOUR,
      ticks: 480,
      skippedMs: 0,
      cropsReady: [
        {
          greenhouseId,
          plotId: tomato?.id,
          cropId: 'tomato',
          readyAtHour: ripe.readyAtHour,
          quality: ripe.quality,
          yieldUnits: content.crops.tomato.yieldPerPlot,
        },
      ],
      spoiled: [
        {
          cropId: 'microgreens',
          units: content.crops.microgreens.yieldPerPlot,
        },
      ],
      moneyChange: game.money - closedGame.money,
    });
  });
});
