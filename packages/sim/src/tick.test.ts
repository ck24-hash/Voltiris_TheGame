import { CROP_IDS, defaultContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { createManualClock } from './clock';
import { initialEnergy } from './energy';
import { createGame } from './newGame';
import { STATE_VERSION, type GameState } from './state';
import { advance, maxCatchUpTicks, tick } from './tick';
import {
  deepFreeze,
  firstGreenhouse,
  newTestGame,
  optimalClimate,
  plant,
  plantingAt,
  runTicks,
  STILL_AIR,
  TEST_PLAYER_ID,
  withClimate,
} from './test-utils';
import { ticksDue } from './time';

const MS_PER_TICK = defaultContent.time.realMsPerTick;

describe('createGame', () => {
  it('starts a game with one empty greenhouse, empty storage and a calm market', () => {
    const clock = createManualClock(1_700_000_000_000);
    const state = createGame(
      { playerId: TEST_PLAYER_ID, seed: 42 },
      defaultContent,
      clock,
    );
    const { greenhouse: config, economy, control } = defaultContent;

    expect(state.version).toBe(STATE_VERSION);
    expect(state.storage).toEqual({ lots: [] });
    expect(Object.values(state.market.swings)).toEqual(CROP_IDS.map(() => 1));
    expect(state.playerId).toBe(TEST_PLAYER_ID);
    expect(state.clock).toEqual({ gameHour: 0, lastTickAt: clock.now() });
    expect(state.money).toBe(economy.startingMoney);
    expect(state.owed).toBe(0);
    expect(state.energy).toEqual(initialEnergy());
    expect(state.greenhouses).toHaveLength(1);

    const greenhouse = firstGreenhouse(state);
    expect(greenhouse.climate).toEqual(config.startingClimate);
    expect(greenhouse.plots).toHaveLength(config.sizes[0]?.plots ?? -1);
    expect(greenhouse.plots.every((p) => p.planting === null)).toBe(true);
    // The first glass and size, no equipment, the player's starting targets.
    expect(greenhouse).toMatchObject({
      glass: 1,
      size: 1,
      equipment: {},
      setpoints: control.initial,
      computer: false,
      auto: false,
    });
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
    expect(plantingAt(runTicks(state, 10, STILL_AIR))).toMatchObject({
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
    const ready = runTicks(state, 30, STILL_AIR);
    expect(plantingAt(ready)?.status).toBe('ready');
    expect(plantingAt(runTicks(ready, 100))).toEqual(plantingAt(ready));
  });

  it('never mutates the input state', () => {
    const state = deepFreeze(plant(newTestGame(), 'tomato'));
    expect(() => tick(state, defaultContent)).not.toThrow();
  });

  it('moves market prices every tick, with the seeded rng', () => {
    const state = newTestGame();
    const next = tick(state, defaultContent);
    expect(next.market).not.toEqual(state.market);
    expect(next.rng).not.toEqual(state.rng);
    expect(tick(state, defaultContent)).toEqual(next);
  });

  it('throws away spoiled harvests in storage', () => {
    const lot = {
      id: 'lot-1',
      cropId: 'strawberry',
      units: 8,
      quality: 1,
      harvestedAtHour: 0,
    } as const;
    const state = { ...newTestGame(), storage: { lots: [lot] } };
    const shelfLife = defaultContent.crops.strawberry.shelfLifeDays * 24;
    expect(runTicks(state, shelfLife - 1).storage.lots).toEqual([lot]);
    expect(runTicks(state, shelfLife).storage.lots).toEqual([]);
  });
});

describe('water and nutrients', () => {
  const { cucumber } = defaultContent.crops;
  const climate = (state: GameState) => firstGreenhouse(state).climate;
  const run = (state: GameState, ticks: number) =>
    runTicks(state, ticks, STILL_AIR);

  it('are used up by growing crops, in proportion to their growth', () => {
    const start = plant(
      plant(withClimate(newTestGame(), optimalClimate('cucumber')), 'cucumber'),
      'cucumber',
      1,
    );
    const after = run(start, 10);
    // Two cucumbers at full speed grow 10 hours each.
    expect(climate(after).water).toBeCloseTo(
      climate(start).water - 2 * 10 * cucumber.waterUse,
      10,
    );
    expect(climate(after).nutrients).toBeCloseTo(
      climate(start).nutrients - 2 * 10 * cucumber.nutrientUse,
      10,
    );
  });

  it('are not used by a crop that has stopped growing, or one that is ready', () => {
    const frozen = { ...optimalClimate('tomato'), temperature: 10 };
    const stalled = plant(withClimate(newTestGame(), frozen), 'tomato');
    expect(climate(run(stalled, 50))).toEqual(frozen);

    const cucumbers = withClimate(newTestGame(), optimalClimate('cucumber'));
    const ready = run(plant(cucumbers, 'cucumber'), 30);
    expect(plantingAt(ready)?.status).toBe('ready');
    expect(climate(run(ready, 50))).toEqual(climate(ready));
  });

  it('running dry stops growth and lowers quality, but the crop lives on', () => {
    const wet = withClimate(newTestGame(), optimalClimate('cucumber'));
    const dry = withClimate(wet, { water: cucumber.climate.water.limitLow });
    const wetCrop = plantingAt(run(plant(wet, 'cucumber'), 20));
    const dryCrop = plantingAt(run(plant(dry, 'cucumber'), 20));
    expect(dryCrop).toMatchObject({ status: 'growing', growthHours: 0 });
    expect(dryCrop?.stress).toBeGreaterThan(wetCrop?.stress ?? 0);

    // Watered again, it grows on.
    const watered = withClimate(run(plant(dry, 'cucumber'), 20), {
      water: optimalClimate('cucumber').water,
    });
    expect(plantingAt(run(watered, 30))?.status).toBe('ready');
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

  it('simulates at most 24 real hours and skips the rest', () => {
    const { clock, state } = setup();
    const cap = maxCatchUpTicks(defaultContent);
    expect(cap).toBe(24 * 240);

    clock.advance(30 * 60 * 60 * 1000 + MS_PER_TICK / 2);
    const next = advance(state, clock, defaultContent);
    expect(next.clock.gameHour).toBe(cap);
    // The game resumes from now; the half tick of leftover time carries over.
    expect(next.clock.lastTickAt).toBe(clock.now() - MS_PER_TICK / 2);

    clock.advance(MS_PER_TICK / 2);
    expect(advance(next, clock, defaultContent).clock.gameHour).toBe(cap + 1);
  });

  it('runs exactly the cap when exactly 24 hours are due', () => {
    const { clock, state } = setup();
    clock.advance(defaultContent.time.maxCatchUpMs);
    expect(advance(state, clock, defaultContent).clock).toEqual({
      gameHour: maxCatchUpTicks(defaultContent),
      lastTickAt: clock.now(),
    });
  });
});
