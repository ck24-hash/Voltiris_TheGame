import { defaultContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { autoSetpoints, controlSetpoints } from './control';
import type { GameState } from './state';
import {
  firstGreenhouse,
  newTestGame,
  plant,
  withGreenhouse,
} from './test-utils';

const content = defaultContent;
const { ranges } = content.control;

function withComputer(state: GameState, auto = true): GameState {
  return withGreenhouse(state, () => ({ computer: true, auto }));
}

describe('controlSetpoints', () => {
  it("are the player's, without a climate computer or with it on manual", () => {
    const planted = plant(newTestGame(), 'tomato');
    for (const state of [planted, withComputer(planted, false)]) {
      const greenhouse = firstGreenhouse(state);
      expect(controlSetpoints(greenhouse, content)).toBe(greenhouse.setpoints);
    }
  });

  it("are the computer's when it is on auto", () => {
    const greenhouse = firstGreenhouse(
      withComputer(plant(newTestGame(), 'tomato')),
    );
    expect(controlSetpoints(greenhouse, content)).toEqual(
      autoSetpoints(greenhouse, content),
    );
  });
});

describe('autoSetpoints', () => {
  it('lets every device idle while nothing grows', () => {
    expect(autoSetpoints(firstGreenhouse(newTestGame()), content)).toEqual({
      heatTo: ranges.heatTo.min,
      ventAbove: ranges.ventAbove.max,
      humidityMax: ranges.humidityMax.max,
      humidityMin: ranges.humidityMin.min,
      co2: ranges.co2.min,
      light: ranges.light.min,
      water: ranges.water.min,
    });
  });

  it('aims just inside the crop’s optimal bands, and waters to the middle', () => {
    const greenhouse = firstGreenhouse(plant(newTestGame(), 'cucumber'));
    const { climate } = content.crops.cucumber;
    const inside = (variable: keyof typeof climate, share: number) =>
      climate[variable].optimalLow +
      share * (climate[variable].optimalHigh - climate[variable].optimalLow);
    const targets = autoSetpoints(greenhouse, content);
    expect(targets.heatTo).toBeCloseTo(inside('temperature', 0.1), 12);
    expect(targets.ventAbove).toBeCloseTo(inside('temperature', 0.9), 12);
    expect(targets.humidityMin).toBeCloseTo(inside('humidity', 0.1), 12);
    expect(targets.humidityMax).toBeCloseTo(inside('humidity', 0.9), 12);
    expect(targets.co2).toBeCloseTo(inside('co2', 0.1), 12);
    expect(targets.light).toBeCloseTo(inside('light', 0.1), 12);
    expect(targets.water).toBeCloseTo(inside('water', 0.5), 12);
  });

  it('suits every crop growing where their bands overlap', () => {
    // Tomato wants 18–26 °C, cucumber 22–28 °C: the computer keeps 22–26.
    const greenhouse = firstGreenhouse(
      plant(plant(newTestGame(), 'tomato', 0), 'cucumber', 1),
    );
    const targets = autoSetpoints(greenhouse, content);
    expect(targets.heatTo).toBeCloseTo(22.4, 12);
    expect(targets.ventAbove).toBeCloseTo(25.6, 12);
  });

  it('takes the middle ground where the crops disagree', () => {
    // Microgreens want at most 450 PAR, tomatoes at least 500.
    const greenhouse = firstGreenhouse(
      plant(plant(newTestGame(), 'microgreens', 0), 'tomato', 1),
    );
    expect(autoSetpoints(greenhouse, content).light).toBe(475);
  });

  it('ignores crops that are ready', () => {
    const ready = withGreenhouse(plant(newTestGame(), 'pepper'), (g) => ({
      plots: g.plots.map((p) =>
        p.planting
          ? {
              ...p,
              planting: {
                ...p.planting,
                status: 'ready' as const,
                readyAtHour: 0,
                quality: 1,
                yieldUnits: 10,
              },
            }
          : p,
      ),
    }));
    expect(autoSetpoints(firstGreenhouse(ready), content)).toEqual(
      autoSetpoints(firstGreenhouse(newTestGame()), content),
    );
  });
});
