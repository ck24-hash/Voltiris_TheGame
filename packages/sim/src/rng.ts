// Seeded PRNG (mulberry32). Its state is stored in GameState, so a reloaded
// game continues the exact same random sequence.

export interface RngState {
  readonly seed: number;
  readonly state: number;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** RFC 4122 version 4 UUID drawn from the seeded stream. */
  uuid(): string;
  /** Current state, to store back into GameState. */
  snapshot(): RngState;
}

const UINT32_RANGE = 2 ** 32;

export function seedRng(seed: number): RngState {
  const normalized = seed >>> 0;
  return { seed: normalized, state: normalized };
}

export function createRng(initial: RngState): Rng {
  const seed = initial.seed;
  let state = initial.state >>> 0;

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  const next = (): number => nextUint32() / UINT32_RANGE;

  return {
    next,

    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`Invalid integer range [${min}, ${max}]`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },

    uuid() {
      const hex = [nextUint32(), nextUint32(), nextUint32(), nextUint32()]
        .map((n) => n.toString(16).padStart(8, '0'))
        .join('');
      const variant = ((parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        `4${hex.slice(13, 16)}`,
        `${variant}${hex.slice(17, 20)}`,
        hex.slice(20, 32),
      ].join('-');
    },

    snapshot: () => ({ seed, state }),
  };
}
