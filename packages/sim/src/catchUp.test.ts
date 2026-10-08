import { defaultContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { catchUp } from './catchUp';
import { createManualClock } from './clock';
import { createGame } from './newGame';
import { advance } from './tick';
import {
  firstGreenhouse,
  optimalClimate,
  plant,
  TEST_PLAYER_ID,
  withClimate,
} from './test-utils';

const MS_PER_TICK = defaultContent.time.realMsPerTick;
const HOUR_MS = 60 * 60 * 1000;

/** Cucumber in plot 0 and tomato in plot 1, in a cucumber-perfect climate. */
function setup() {
  const clock = createManualClock(1_000_000);
  const game = createGame(
    { playerId: TEST_PLAYER_ID, seed: 7 },
    defaultContent,
    clock,
  );
  const state = plant(
    plant(withClimate(game, optimalClimate('cucumber')), 'cucumber', 0),
    'tomato',
    1,
  );
  return { clock, state };
}

describe('catchUp', () => {
  it('fast-forwards a 2-hour break exactly like advance, and reports it', () => {
    const { clock, state } = setup();
    clock.advance(2 * HOUR_MS);

    const { state: next, report } = catchUp(state, clock, defaultContent);

    expect(next).toEqual(advance(state, clock, defaultContent));
    expect(next.clock.gameHour).toBe(480);
    // A cucumber needs 20 days (480 h) in a perfect climate; the tomato 30.
    const greenhouse = firstGreenhouse(next);
    expect(report).toEqual({
      awayMs: 2 * HOUR_MS,
      ticks: 480,
      skippedMs: 0,
      cropsReady: [
        {
          greenhouseId: greenhouse.id,
          plotId: greenhouse.plots[0]?.id,
          cropId: 'cucumber',
          readyAtHour: 480,
          quality: 1,
          yieldUnits: defaultContent.crops.cucumber.yieldPerPlot,
        },
      ],
      moneyChange: 0,
    });
  });

  it('reports the time skipped beyond the 24-hour cap', () => {
    const { clock, state } = setup();
    clock.advance(30 * HOUR_MS);
    const { report } = catchUp(state, clock, defaultContent);
    expect(report.ticks).toBe(24 * 240);
    expect(report.awayMs).toBe(30 * HOUR_MS);
    expect(report.skippedMs).toBe(6 * HOUR_MS);
  });

  it('only reports crops that became ready during the catch-up', () => {
    const { clock, state } = setup();
    clock.advance(2 * HOUR_MS);
    const first = catchUp(state, clock, defaultContent);
    expect(first.report.cropsReady).toHaveLength(1);

    clock.advance(10 * MS_PER_TICK);
    const second = catchUp(first.state, clock, defaultContent);
    expect(second.report).toMatchObject({ ticks: 10, cropsReady: [] });
  });

  it('changes nothing when no tick is due', () => {
    const { clock, state } = setup();
    clock.advance(MS_PER_TICK - 1);
    const { state: next, report } = catchUp(state, clock, defaultContent);
    expect(next).toBe(state);
    expect(report).toMatchObject({ ticks: 0, skippedMs: 0, cropsReady: [] });
  });

  it('reports no time away when the clock went backwards', () => {
    const { clock, state } = setup();
    clock.advance(-HOUR_MS);
    const { state: next, report } = catchUp(state, clock, defaultContent);
    expect(next.clock.lastTickAt).toBe(clock.now());
    expect(report).toMatchObject({ awayMs: 0, ticks: 0, skippedMs: 0 });
  });
});
