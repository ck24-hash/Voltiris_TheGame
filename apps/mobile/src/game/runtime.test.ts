import { createManualClock } from '@voltiris/sim';
import { describe, expect, it } from 'vitest';
import { createScaledClock } from './clock';
import { readDevFlags } from './devFlags';
import { newUuid, randomSeed } from './ids';

describe('readDevFlags', () => {
  it('defaults to normal speed without debug', () => {
    expect(readDevFlags('', {})).toEqual({ speed: 1, debug: false });
  });

  it('reads the URL first, then the build env', () => {
    expect(readDevFlags('?speed=60&debug', {})).toEqual({
      speed: 60,
      debug: true,
    });
    expect(
      readDevFlags('', { VITE_TIME_SPEED: '120', VITE_DEBUG: '1' }),
    ).toEqual({ speed: 120, debug: true });
    expect(readDevFlags('?speed=2', { VITE_TIME_SPEED: '120' }).speed).toBe(2);
  });

  it('ignores invalid speeds', () => {
    expect(readDevFlags('?speed=fast', {}).speed).toBe(1);
    expect(readDevFlags('?speed=-5', {}).speed).toBe(1);
    expect(readDevFlags('?speed=0', {}).speed).toBe(1);
  });
});

describe('createScaledClock', () => {
  it('runs faster than its base clock from the moment it starts', () => {
    const base = createManualClock(1000);
    const fast = createScaledClock(base, 60);
    expect(fast.now()).toBe(1000);
    base.advance(1000);
    expect(fast.now()).toBe(61_000);
  });

  it('is the base clock at speed 1', () => {
    const base = createManualClock(0);
    expect(createScaledClock(base, 1)).toBe(base);
  });
});

describe('ids', () => {
  it('makes unique version 4 UUIDs', () => {
    const ids = Array.from({ length: 200 }, newUuid);
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('makes unsigned 32-bit seeds', () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });
});
