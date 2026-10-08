import {
  CLIMATE_VARIABLES,
  defaultContent,
  type Climate,
} from '@voltiris/content';
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

/** A new game whose greenhouse is perfect for cucumbers. */
function newCucumberGame(clock: Clock): GameState {
  const game = createGame({ playerId: 'player', seed: 3 }, content, clock);
  const bands = content.crops.cucumber.climate;
  const climate = Object.fromEntries(
    CLIMATE_VARIABLES.map((v) => [
      v,
      (bands[v].optimalLow + bands[v].optimalHigh) / 2,
    ]),
  ) as Climate;
  const [greenhouse] = game.greenhouses;
  if (!greenhouse) throw new Error('no greenhouse');
  return { ...game, greenhouses: [{ ...greenhouse, climate }] };
}

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

    // Session 1: plant a cucumber and play for 10 minutes.
    const first = storeFor(newCucumberGame(clock), clock);
    const stopLoop = startGameLoop(first, { lifecycle: app.lifecycle });
    const autosave = startAutosave({
      store: first,
      saveStore: createIndexedDbSaveStore('voltiris', db),
      now: () => clock.now(),
      lifecycle: app.lifecycle,
    });
    const greenhouse = first.getState().game.greenhouses[0];
    const plot = greenhouse?.plots[0];
    first
      .getState()
      .plantCrop(greenhouse?.id ?? '', plot?.id ?? '', 'cucumber');
    await vi.advanceTimersByTimeAsync(10 * MINUTE);

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
    expect(away).toEqual({
      awayMs: 2 * HOUR,
      ticks: 480,
      skippedMs: 0,
      cropsReady: [
        {
          greenhouseId: greenhouse?.id,
          plotId: plot?.id,
          cropId: 'cucumber',
          readyAtHour: 480,
          quality: 1,
          yieldUnits: content.crops.cucumber.yieldPerPlot,
        },
      ],
      moneyChange: 0,
    });
  });
});
