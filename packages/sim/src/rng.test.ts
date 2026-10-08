import { describe, expect, it } from 'vitest';
import { createRng, seedRng } from './rng';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function take(seed: number, count: number): number[] {
  const rng = createRng(seedRng(seed));
  return Array.from({ length: count }, () => rng.next());
}

describe('rng', () => {
  it('matches the reference mulberry32 sequence (keeps old saves valid)', () => {
    expect(take(42, 3)).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    ]);
  });

  it('gives the same sequence for the same seed', () => {
    expect(take(1234, 50)).toEqual(take(1234, 50));
  });

  it('gives different sequences for different seeds', () => {
    expect(take(1, 5)).not.toEqual(take(2, 5));
  });

  it('continues identically after a snapshot is saved and restored', () => {
    const rng = createRng(seedRng(7));
    for (let i = 0; i < 10; i++) rng.next();
    const saved: unknown = JSON.parse(JSON.stringify(rng.snapshot()));
    const restored = createRng(saved as ReturnType<typeof rng.snapshot>);
    const expected = Array.from({ length: 10 }, () => rng.next());
    expect(Array.from({ length: 10 }, () => restored.next())).toEqual(expected);
  });

  it('keeps the original seed in snapshots', () => {
    const rng = createRng(seedRng(99));
    rng.next();
    expect(rng.snapshot().seed).toBe(99);
    expect(rng.snapshot().state).not.toBe(99);
  });

  it('normalizes seeds to unsigned 32-bit integers', () => {
    expect(seedRng(-1)).toEqual({ seed: 4294967295, state: 4294967295 });
    expect(seedRng(2 ** 32 + 5).seed).toBe(5);
    expect(seedRng(3.7).seed).toBe(3);
  });

  it('next() stays in [0, 1) and is roughly uniform', () => {
    const values = take(2026, 10_000);
    const buckets = new Array<number>(10).fill(0);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const bucket = Math.floor(v * 10);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(900);
      expect(count).toBeLessThan(1100);
    }
  });

  it('int() is inclusive and covers the whole range', () => {
    const rng = createRng(seedRng(5));
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2, 3]);
  });

  it('int() rejects invalid ranges', () => {
    const rng = createRng(seedRng(5));
    expect(() => rng.int(3, 1)).toThrow(RangeError);
    expect(() => rng.int(0.5, 2)).toThrow(RangeError);
  });

  it('uuid() returns unique version 4 UUIDs', () => {
    const rng = createRng(seedRng(11));
    const ids = Array.from({ length: 1000 }, () => rng.uuid());
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
