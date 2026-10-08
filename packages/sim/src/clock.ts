/**
 * Source of real (wall-clock) time in milliseconds. The sim only learns the
 * time through an injected Clock; the app provides one backed by Date.now().
 */
export interface Clock {
  now(): number;
}

/** A clock that only moves when told to; for tests and replays. */
export interface ManualClock extends Clock {
  set(ms: number): void;
  advance(ms: number): void;
}

export function createManualClock(startMs = 0): ManualClock {
  let current = startMs;
  return {
    now: () => current,
    set: (ms) => {
      current = ms;
    },
    advance: (ms) => {
      current += ms;
    },
  };
}
