import { defaultContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { idealRange, readGauge } from './gauges';

const { tomato, cucumber, microgreens } = defaultContent.crops;

describe('readGauge', () => {
  it('is idle when nothing is growing', () => {
    expect(readGauge('temperature', 20, [])).toEqual({
      status: 'idle',
      note: 'No crops',
    });
  });

  it('is good inside the optimal band', () => {
    expect(readGauge('temperature', 22, [tomato])).toEqual({
      status: 'good',
      note: 'Good',
    });
  });

  it('warns in plain language when a value slows growth', () => {
    expect(readGauge('temperature', 14, [tomato])).toEqual({
      status: 'warn',
      note: 'Too cold',
    });
    expect(readGauge('temperature', 30, [tomato])).toEqual({
      status: 'warn',
      note: 'Too hot',
    });
    expect(readGauge('co2', 420, [tomato])).toEqual({
      status: 'warn',
      note: 'Low',
    });
  });

  it('is bad when a value stops growth', () => {
    expect(readGauge('water', 20, [tomato])).toEqual({
      status: 'bad',
      note: 'Thirsty',
    });
  });

  it('judges the value as it is shown', () => {
    // Cucumbers want 22 °C or more; 21.98 °C shows as "22.0 °C".
    expect(readGauge('temperature', 21.98, [cucumber]).status).toBe('good');
    expect(readGauge('temperature', 21.94, [cucumber]).status).toBe('warn');
    expect(readGauge('humidity', 69.6, [cucumber]).status).toBe('good');
  });

  it('judges by the crop that is worst off', () => {
    // 20 °C is fine for tomato (18–26) but cold for cucumber (22–28).
    expect(readGauge('temperature', 20, [tomato]).status).toBe('good');
    expect(readGauge('temperature', 20, [tomato, cucumber])).toEqual({
      status: 'warn',
      note: 'Too cold',
    });
  });
});

describe('idealRange', () => {
  it('is nothing while nothing grows', () => {
    expect(idealRange('temperature', [])).toBeNull();
  });

  it("is a crop's optimal band", () => {
    expect(idealRange('temperature', [cucumber])).toEqual({
      low: cucumber.climate.temperature.optimalLow,
      high: cucumber.climate.temperature.optimalHigh,
      shared: true,
    });
  });

  it('is where the bands of all the crops growing overlap', () => {
    // Tomato wants 18–26 °C, cucumber 22–28 °C.
    expect(idealRange('temperature', [tomato, cucumber])).toEqual({
      low: 22,
      high: 26,
      shared: true,
    });
  });

  it('is the middle ground when the crops disagree', () => {
    // Microgreens want at most 450 PAR, tomatoes at least 500.
    expect(idealRange('light', [microgreens, tomato])).toEqual({
      low: 450,
      high: 500,
      shared: false,
    });
  });
});
