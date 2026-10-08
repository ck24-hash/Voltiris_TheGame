import { defaultContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { catchUp } from './catchUp';
import { createManualClock } from './clock';
import { createGame } from './newGame';
import { advance } from './tick';
import {
  firstGreenhouse,
  harvest,
  optimalClimate,
  plant,
  runTicks,
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
  it('fast-forwards a 30-minute break exactly like advance, and reports it', () => {
    const { clock, state } = setup();
    clock.advance(HOUR_MS / 2);

    const { state: next, report } = catchUp(state, clock, defaultContent);

    expect(next).toEqual(advance(state, clock, defaultContent));
    expect(next.clock.gameHour).toBe(120);
    // A cucumber needs 24 h in a perfect climate; the tomato much longer.
    const greenhouse = firstGreenhouse(next);
    expect(report).toEqual({
      awayMs: HOUR_MS / 2,
      ticks: 120,
      skippedMs: 0,
      cropsReady: [
        {
          greenhouseId: greenhouse.id,
          plotId: greenhouse.plots[0]?.id,
          cropId: 'cucumber',
          readyAtHour: 24,
          quality: 1,
          yieldUnits: defaultContent.crops.cucumber.yieldPerPlot,
        },
      ],
      spoiled: [],
      moneyChange: 0,
    });
  });

  it('reports harvests that spoiled in storage', () => {
    const { clock, state } = setup();
    const ready = runTicks(state, 24);
    const stored = harvest(ready, 0);
    // The harvest's whole shelf life passes while the player is away.
    clock.advance(
      defaultContent.crops.cucumber.shelfLifeDays * 24 * MS_PER_TICK,
    );

    const { state: next, report } = catchUp(stored, clock, defaultContent);
    expect(next.storage.lots).toEqual([]);
    expect(report.spoiled).toEqual([
      {
        cropId: 'cucumber',
        units: defaultContent.crops.cucumber.yieldPerPlot,
      },
    ]);
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
    clock.advance(HOUR_MS / 2);
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
