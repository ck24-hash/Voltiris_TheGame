import type { Clock } from '@voltiris/sim';

export const systemClock: Clock = { now: () => Date.now() };

/** Runs time `speed` times faster than `base`, from the moment it is created. */
export function createScaledClock(base: Clock, speed: number): Clock {
  if (speed === 1) return base;
  const start = base.now();
  return { now: () => start + (base.now() - start) * speed };
}
