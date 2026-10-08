import type { Clock } from '@voltiris/sim';

export const systemClock: Clock = { now: () => Date.now() };

/**
 * Runs time `speed` times faster than `base`, including the time the app was
 * closed: at speed 240, closing the app for 30 s is a 2-hour break. A game
 * saved at one speed and loaded at another just jumps (the 24-hour catch-up
 * cap or the backwards-clock rule absorbs it).
 */
export function createScaledClock(base: Clock, speed: number): Clock {
  if (speed === 1) return base;
  return { now: () => base.now() * speed };
}
