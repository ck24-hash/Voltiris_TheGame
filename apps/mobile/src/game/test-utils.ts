// Helpers for app tests. Not used by the app itself.

import { defaultContent } from '@voltiris/content';
import { createGame, createManualClock } from '@voltiris/sim';
import type { AppLifecycle } from './lifecycle';
import { createGameStore } from './store';

export function createTestStore(seed = 1) {
  const clock = createManualClock(0);
  const game = createGame(
    { playerId: '00000000-0000-4000-8000-000000000000', seed },
    defaultContent,
    clock,
  );
  let commandCount = 0;
  const store = createGameStore({
    content: defaultContent,
    clock,
    newId: () => `cmd-${++commandCount}`,
    game,
  });
  return { clock, store };
}

/** A lifecycle the test drives by hand: hide() and show() the app. */
export function createFakeLifecycle() {
  const hideListeners = new Set<() => void>();
  const showListeners = new Set<() => void>();
  const listen = (set: Set<() => void>) => (listener: () => void) => {
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  };
  const lifecycle: AppLifecycle = {
    onHide: listen(hideListeners),
    onShow: listen(showListeners),
  };
  return {
    lifecycle,
    hide: () => hideListeners.forEach((l) => l()),
    show: () => showListeners.forEach((l) => l()),
  };
}

export function firstGreenhouseOf(
  store: ReturnType<typeof createTestStore>['store'],
) {
  const greenhouse = store.getState().game.greenhouses[0];
  if (!greenhouse) throw new Error('no greenhouse');
  return greenhouse;
}
