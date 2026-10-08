/** One tick is one in-game hour. */
export const HOURS_PER_DAY = 24;

/** Whole ticks that have come due between `lastTickAt` and `nowMs`. */
export function ticksDue(
  lastTickAt: number,
  nowMs: number,
  realMsPerTick: number,
): number {
  if (nowMs <= lastTickAt) return 0;
  return Math.floor((nowMs - lastTickAt) / realMsPerTick);
}
