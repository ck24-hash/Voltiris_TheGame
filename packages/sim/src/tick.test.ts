import { defaultContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { createManualClock } from './clock';
import { createGame } from './newGame';
import { advance, tick } from './tick';
import {
  deepFreeze,
  firstGreenhouse,
  newTestGame,
  optimalClimate,
  plant,
  plantingAt,
  runTicks,
  TEST_PLAYER_ID,
  withClimate,
} from './test-utils';
import { ticksDue } from './time';

const MS_PER_TICK = defaultContent.time.realMsPerTick;

describe('createGame', () => {
  it('starts a version 1 game with one empty greenhouse', () => {
    const clock = createManualClock(1_700_000_000_000);
    const state = createGame(
      { playerId: TEST_PLAYER_ID, seed: 42 },
      defaultContent,
      clock,
    );
    const { startingGreenhouse, economy } = defaultContent;

    expect(state.version).toBe(1);
    expect(state.playerId).toBe(TEST_PLAYER_ID);
    expect(state.clock).toEqual({ gameHour: 0, lastTickAt: clock.now() });
    expect(state.money).toBe(economy.startingMoney);
    expect(state.greenhouses).toHaveLength(1);

    const greenhouse = firstGreenhouse(state);
    expect(greenhouse.climate).toEqual(startingGreenhouse.climate);
    expect(greenhouse.plots).toHaveLength(startingGreenhouse.plots);
    expect(greenhouse.plots.every((p) => p.planting === null)).toBe(true);
  });

  it('gives every greenhouse and plot a unique id from the seeded rng', () => {
    const state = newTestGame();
    const ids = [
      firstGreenhouse(state).id,
      ...firstGreenhouse(state).plots.map((p) => p.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.rng.seed).toBe(42);
    expect(state.rng.state).not.toBe(42);
  });
});

describe('tick', () => {
  it('advances the game by one hour', () => {
    const state = newTestGame();
    expect(tick(state, defaultContent).clock.gameHour).toBe(1);
    expect(runTicks(state, 24).clock.gameHour).toBe(24);
  });

  it('leaves lastTickAt to the real-time loop', () => {
    const state = newTestGame();
    expect(tick(state, defaultContent).clock.lastTickAt).toBe(
      state.clock.lastTickAt,
    );
  });

  it('grows planted crops', () => {
    const state = plant(
      withClimate(newTestGame(), optimalClimate('tomato')),
      'tomato',
    );
    expect(plantingAt(runTicks(state, 10))).toMatchObject({
      status: 'growing',
      growthHours: 10,
      stress: 0,
    });
  });

  it('stops changing a crop once it is ready', () => {
    const state = plant(
      withClimate(newTestGame(), optimalClimate('cucumber')),
      'cucumber',
    );
    const ready = runTicks(state, 480);
    expect(plantingAt(ready)?.status).toBe('ready');
    expect(plantingAt(runTicks(ready, 100))).toEqual(plantingAt(ready));
  });

  it('never mutates the input state', () => {
    const state = deepFreeze(plant(newTestGame(), 'tomato'));
    expect(() => tick(state, defaultContent)).not.toThrow();
  });
});

describe('ticksDue', () => {
  it('counts whole ticks only', () => {
    expect(ticksDue(0, MS_PER_TICK - 1, MS_PER_TICK)).toBe(0);
    expect(ticksDue(0, MS_PER_TICK, MS_PER_TICK)).toBe(1);
    expect(ticksDue(1000, 1000 + 3.5 * MS_PER_TICK, MS_PER_TICK)).toBe(3);
  });

  it('is 0 when the clock is at or behind the last tick', () => {
    expect(ticksDue(5000, 5000, MS_PER_TICK)).toBe(0);
    expect(ticksDue(5000, 0, MS_PER_TICK)).toBe(0);
  });
});

describe('advance', () => {
  function setup() {
    const clock = createManualClock(0);
    const state = createGame(
      { playerId: TEST_PLAYER_ID, seed: 1 },
      defaultContent,
      clock,
    );
    return { clock, state };
  }

  it('does nothing before a full tick of real time has passed', () => {
    const { clock, state } = setup();
    clock.advance(MS_PER_TICK - 1);
    expect(advance(state, clock, defaultContent)).toBe(state);
  });

  it('runs one tick per 15 real seconds', () => {
    const { clock, state } = setup();
    clock.advance(3 * MS_PER_TICK);
    const next = advance(state, clock, defaultContent);
    expect(next.clock).toEqual({ gameHour: 3, lastTickAt: 3 * MS_PER_TICK });
  });

  it('carries leftover time over so ticks never drift', () => {
    const { clock, state } = setup();
    clock.advance(2.5 * MS_PER_TICK);
    const first = advance(state, clock, defaultContent);
    expect(first.clock).toEqual({ gameHour: 2, lastTickAt: 2 * MS_PER_TICK });

    clock.advance(0.5 * MS_PER_TICK);
    const second = advance(first, clock, defaultContent);
    expect(second.clock).toEqual({ gameHour: 3, lastTickAt: 3 * MS_PER_TICK });
  });

  it('gives the same result as running the same ticks by hand', () => {
    const { clock, state } = setup();
    const planted = plant(state, 'tomato');
    clock.advance(100 * MS_PER_TICK);
    const advanced = advance(planted, clock, defaultContent);
    expect(advanced).toEqual({
      ...runTicks(planted, 100),
      clock: { gameHour: 100, lastTickAt: 100 * MS_PER_TICK },
    });
  });

  it('restarts from now if the clock went backwards, instead of freezing', () => {
    const { clock, state } = setup();
    clock.set(10 * MS_PER_TICK);
    const ahead = advance(state, clock, defaultContent);
    expect(ahead.clock).toEqual({ gameHour: 10, lastTickAt: 10 * MS_PER_TICK });

    // The device clock is set back an hour: no ticks, no freeze.
    clock.set(10 * MS_PER_TICK - 3_600_000);
    const rebased = advance(ahead, clock, defaultContent);
    expect(rebased.clock).toEqual({
      gameHour: 10,
      lastTickAt: clock.now(),
    });

    clock.advance(MS_PER_TICK);
    expect(advance(rebased, clock, defaultContent).clock.gameHour).toBe(11);
  });
});
