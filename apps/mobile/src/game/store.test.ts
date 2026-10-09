import { defaultContent } from '@voltiris/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameStore, startGameLoop } from './store';
import {
  createFakeLifecycle,
  createTestStore,
  firstGreenhouseOf,
} from './test-utils';

const MS_PER_TICK = defaultContent.time.realMsPerTick;
const ANCHOR = { x: 100, top: 100, bottom: 140 };

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
    const error = store.getState().plantCrop(greenhouse.id, plotId, 'tomato');

    const { game } = store.getState();
    expect(error).toBeNull();
    expect(game.clock.gameHour).toBe(5);
    expect(firstGreenhouseOf(store).plots[0]?.planting).toMatchObject({
      status: 'growing',
      cropId: 'tomato',
      plantedAtHour: 5,
    });
  });

  it('times a command and its catch-up with one clock reading', () => {
    // A clock that has moved past a tick boundary on every read.
    let reads = 0;
    const clock = {
      now: () => (reads++ === 0 ? MS_PER_TICK - 1 : MS_PER_TICK),
    };
    const { store: base } = createTestStore();
    const store = createGameStore({
      content: defaultContent,
      clock,
      newId: () => 'cmd',
      game: base.getState().game,
    });
    const greenhouse = firstGreenhouseOf(store);
    store
      .getState()
      .plantCrop(greenhouse.id, greenhouse.plots[0]?.id ?? '', 'tomato');

    expect(reads).toBe(1);
    expect(store.getState().game.clock.gameHour).toBe(0);
    expect(firstGreenhouseOf(store).plots[0]?.planting?.plantedAtHour).toBe(0);
  });

  it('returns why the sim refused a command, and changes nothing', () => {
    const { store } = createTestStore();
    const greenhouse = firstGreenhouseOf(store);
    const plotId = greenhouse.plots[0]?.id ?? '';

    store.getState().plantCrop(greenhouse.id, plotId, 'tomato');
    const before = store.getState().game;
    const error = store.getState().plantCrop(greenhouse.id, plotId, 'pepper');
    expect(error?.code).toBe('PLOT_OCCUPIED');
    expect(store.getState().game).toBe(before);
  });

  it('runs the whole crop loop: plant, water, harvest and sell', () => {
    const { clock, store } = createTestStore();
    const greenhouse = firstGreenhouseOf(store);
    const plotId = greenhouse.plots[0]?.id ?? '';
    const actions = store.getState();
    const money = () => store.getState().game.money;

    expect(actions.plantCrop(greenhouse.id, plotId, 'microgreens')).toBeNull();
    expect(actions.water(greenhouse.id)).toBeNull();
    expect(actions.harvestCrop(greenhouse.id, plotId)?.code).toBe('NOT_READY');

    clock.advance(10 * MS_PER_TICK);
    expect(actions.harvestCrop(greenhouse.id, plotId)).toBeNull();
    const beforeSale = money();
    const { yieldPerPlot } = defaultContent.crops.microgreens;
    expect(actions.sellCrop('microgreens', yieldPerPlot)).toBeNull();

    expect(store.getState().game.storage.lots).toEqual([]);
    expect(money()).toBeGreaterThan(beforeSale);
    expect(store.getState().checkpoint).toBe(4);
  });

  it('buys, services, sets and upgrades the greenhouse through commands', () => {
    const { store } = createTestStore();
    const { id } = firstGreenhouseOf(store);
    const actions = store.getState();

    expect(actions.setAutoControl(id, true)?.code).toBe('NO_COMPUTER');
    expect(actions.buyEquipment(id, 'heater')).toBeNull();
    expect(actions.serviceEquipment(id, 'heater')?.code).toBe('NOT_WORN');
    expect(actions.setSetpoint(id, 'heatTo', 24)).toBeNull();
    expect(actions.upgradeGreenhouse(id, 'glass')?.code).toBe(
      'NOT_ENOUGH_MONEY',
    );

    const greenhouse = firstGreenhouseOf(store);
    expect(greenhouse.equipment.heater).toEqual({ level: 1, wear: 0 });
    expect(greenhouse.setpoints.heatTo).toBe(24);
    expect(store.getState().checkpoint).toBe(2);
  });

  it('builds energy assets through commands', () => {
    const { store } = createTestStore();
    expect(store.getState().buyEnergy('solar')).toBeNull();
    expect(store.getState().buyEnergy('chp')?.code).toBe('NOT_ENOUGH_MONEY');
    expect(store.getState().game.energy.solar).toBe(1);
    expect(store.getState().checkpoint).toBe(1);
  });

  it('asks for a save after every accepted command, not a rejected one', () => {
    const { store } = createTestStore();
    const greenhouse = firstGreenhouseOf(store);
    const plotId = greenhouse.plots[0]?.id ?? '';
    store.getState().plantCrop(greenhouse.id, plotId, 'tomato');
    expect(store.getState().checkpoint).toBe(1);
    store.getState().plantCrop(greenhouse.id, plotId, 'tomato');
    expect(store.getState().checkpoint).toBe(1);
  });

  it('closes the plot bubble when a window opens', () => {
    const { store } = createTestStore();
    store.getState().selectPlot({ plotId: 'some-plot', anchor: ANCHOR });
    store.getState().openWindow('market');
    expect(store.getState()).toMatchObject({
      window: 'market',
      selection: null,
    });
    store.getState().closeWindow();
    expect(store.getState().window).toBeNull();
  });

  it('can start with a window open: the guide, for a new game', () => {
    const { clock, store } = createTestStore();
    const guided = createGameStore({
      content: defaultContent,
      clock,
      newId: () => 'cmd',
      game: store.getState().game,
      window: 'guide',
    });
    expect(guided.getState().window).toBe('guide');
    expect(store.getState().window).toBeNull();
  });
});

describe('time away', () => {
  it('summarises a break of 5 minutes or more until dismissed', () => {
    const { clock, store } = createTestStore();
    clock.advance(4 * 60_000);
    store.getState().advance();
    expect(store.getState().away).toBeNull();

    store.getState().markAway();
    clock.advance(2 * 60 * 60_000);
    store.getState().advance();
    expect(store.getState().away).toMatchObject({
      awayMs: 2 * 60 * 60_000,
      ticks: 480,
    });

    store.getState().dismissAway();
    expect(store.getState().away).toBeNull();
  });

  it('never greets a brand-new game, even if its first ticks come late', () => {
    const { clock, store } = createTestStore();
    store.getState().advance();
    // Loading the map held the game loop up (a long time at dev speed).
    clock.advance(10 * 60_000);
    store.getState().advance();
    expect(store.getState().away).toBeNull();
  });

  it('never summarises a long stall while the player is playing', () => {
    const { clock, store } = createTestStore();
    clock.advance(MS_PER_TICK);
    store.getState().advance();
    // The device froze (or a dev speed-up made a short stall long).
    clock.advance(2 * 60 * 60_000);
    store.getState().advance();
    expect(store.getState().away).toBeNull();
    expect(store.getState().game.clock.gameHour).toBe(481);
  });

  it('adds up a second break that comes before the summary is closed', () => {
    const { clock, store } = createTestStore();
    clock.advance(60 * 60_000);
    store.getState().advance();
    store.getState().markAway();
    clock.advance(30 * 60_000);
    store.getState().advance();
    expect(store.getState().away).toMatchObject({
      awayMs: 90 * 60_000,
      ticks: 360,
    });
  });

  it('also summarises a break caught up by a command', () => {
    const { clock, store } = createTestStore();
    const greenhouse = firstGreenhouseOf(store);
    clock.advance(60 * 60_000);
    store
      .getState()
      .plantCrop(greenhouse.id, greenhouse.plots[1]?.id ?? '', 'pepper');
    expect(store.getState().away?.ticks).toBe(240);
  });
});

describe('notices and replacing the game', () => {
  it('shows one notice at a time and only dismisses the one shown', () => {
    const { store } = createTestStore();
    store.getState().notify('Saved');
    const first = store.getState().notice;
    store.getState().notify('Could not save', 'error');
    expect(store.getState().notice).toMatchObject({
      text: 'Could not save',
      tone: 'error',
    });
    store.getState().dismissNotice(first?.id ?? -1);
    expect(store.getState().notice?.text).toBe('Could not save');
  });

  it('swaps in another game, clears the screen and asks for a save', () => {
    const { store } = createTestStore();
    const other = createTestStore(99).store.getState().game;
    store.getState().openWindow('settings');
    store.getState().replaceGame(other);
    expect(store.getState()).toMatchObject({
      game: other,
      window: null,
      selection: null,
      away: null,
      checkpoint: 1,
    });
  });
});

describe('game loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function startLoop() {
    const { clock, store } = createTestStore();
    const app = createFakeLifecycle();
    const stop = startGameLoop(store, {
      intervalMs: 500,
      lifecycle: app.lifecycle,
    });
    const hour = () => store.getState().game.clock.gameHour;
    return { clock, store, app, stop, hour };
  }

  it('advances on an interval until stopped', () => {
    const { clock, stop, hour } = startLoop();
    clock.advance(2 * MS_PER_TICK);
    vi.advanceTimersByTime(500);
    expect(hour()).toBe(2);

    stop();
    clock.advance(MS_PER_TICK);
    vi.advanceTimersByTime(1000);
    expect(hour()).toBe(2);
  });

  it('pauses in the background and catches up, with a summary, on return', () => {
    const { clock, store, app, hour } = startLoop();
    clock.advance(MS_PER_TICK);
    vi.advanceTimersByTime(500);
    expect(hour()).toBe(1);

    app.hide();
    clock.advance(60 * 60_000);
    vi.advanceTimersByTime(60 * 60_000);
    expect(hour()).toBe(1);

    app.show();
    expect(hour()).toBe(241);
    expect(store.getState().away?.ticks).toBe(240);

    clock.advance(MS_PER_TICK);
    vi.advanceTimersByTime(500);
    expect(hour()).toBe(242);
  });
});
