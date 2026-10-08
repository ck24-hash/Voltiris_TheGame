import { defaultContent } from '@voltiris/content';
import { describe, expect, it, vi } from 'vitest';
import { startGameLoop } from './store';
import { createTestStore, firstGreenhouseOf } from './test-utils';

const MS_PER_TICK = defaultContent.time.realMsPerTick;

describe('game store', () => {
  it('advances the game only when ticks are due', () => {
    const { clock, store } = createTestStore();
    const before = store.getState().game;

    clock.advance(MS_PER_TICK - 1);
    store.getState().advance();
    expect(store.getState().game).toBe(before);

    clock.advance(1);
    store.getState().advance();
    expect(store.getState().game.clock.gameHour).toBe(1);
  });

  it('catches up on due ticks before applying a command', () => {
    const { clock, store } = createTestStore();
    const greenhouse = firstGreenhouseOf(store);
    const plotId = greenhouse.plots[0]?.id ?? '';

    clock.advance(5 * MS_PER_TICK);
    store.getState().plantCrop(greenhouse.id, plotId, 'tomato');

    const { game, lastError } = store.getState();
    expect(lastError).toBeNull();
    expect(game.clock.gameHour).toBe(5);
    expect(firstGreenhouseOf(store).plots[0]?.planting).toMatchObject({
      status: 'growing',
      cropId: 'tomato',
      plantedAtHour: 5,
    });
  });

  it('keeps the error of a rejected command until the next selection', () => {
    const { store } = createTestStore();
    const greenhouse = firstGreenhouseOf(store);
    const plotId = greenhouse.plots[0]?.id ?? '';

    store.getState().plantCrop(greenhouse.id, plotId, 'tomato');
    store.getState().plantCrop(greenhouse.id, plotId, 'pepper');
    expect(store.getState().lastError?.code).toBe('PLOT_OCCUPIED');
    expect(firstGreenhouseOf(store).plots[0]?.planting?.cropId).toBe('tomato');

    store.getState().selectPlot(plotId);
    expect(store.getState().lastError).toBeNull();
  });

  it('closes the plot panel when switching tabs', () => {
    const { store } = createTestStore();
    store.getState().selectPlot('some-plot');
    store.getState().setTab('market');
    expect(store.getState()).toMatchObject({
      tab: 'market',
      selectedPlotId: null,
    });
  });

  it('runs a loop that advances on an interval until stopped', () => {
    vi.useFakeTimers();
    try {
      const { clock, store } = createTestStore();
      const hour = () => store.getState().game.clock.gameHour;
      const stop = startGameLoop(store, 500);

      clock.advance(2 * MS_PER_TICK);
      vi.advanceTimersByTime(500);
      expect(hour()).toBe(2);

      stop();
      clock.advance(MS_PER_TICK);
      vi.advanceTimersByTime(1000);
      expect(hour()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
