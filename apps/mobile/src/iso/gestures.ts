import type { Point } from './projection';

export interface PointerSample extends Point {
  readonly id: number;
  /** Milliseconds, from the event timestamp. */
  readonly time: number;
}

export interface GestureHandlers {
  /** One finger (or mouse) dragged by (dx, dy). */
  pan(dx: number, dy: number): void;
  /** Two fingers: their midpoint moved from `from` to `to` while their spread changed by `scale`. */
  pinch(from: Point, to: Point, scale: number): void;
  /** A short press that barely moved. */
  tap(point: Point): void;
}

export interface GestureOptions {
  /** Max movement in px for a press to still count as a tap. */
  readonly tapSlop: number;
  /** Max duration in ms for a tap. */
  readonly tapMaxMs: number;
}

export interface GestureTracker {
  down(p: PointerSample): void;
  move(p: PointerSample): void;
  up(p: PointerSample): void;
  cancel(id: number): void;
}

const DEFAULT_OPTIONS: GestureOptions = { tapSlop: 10, tapMaxMs: 500 };

/** Turns raw pointer samples into pan, pinch and tap gestures. */
export function createGestureTracker(
  handlers: GestureHandlers,
  options: GestureOptions = DEFAULT_OPTIONS,
): GestureTracker {
  const pointers = new Map<number, Point>();
  let tapCandidate: PointerSample | null = null;

  const firstTwo = (): [Point, Point] | null => {
    const [a, b] = pointers.values();
    return a && b ? [a, b] : null;
  };

  return {
    down(p) {
      pointers.set(p.id, p);
      tapCandidate = pointers.size === 1 ? p : null;
    },

    move(p) {
      const previous = pointers.get(p.id);
      if (!previous) return;

      if (tapCandidate && distance(tapCandidate, p) > options.tapSlop) {
        tapCandidate = null;
      }

      if (pointers.size === 1) {
        pointers.set(p.id, p);
        handlers.pan(p.x - previous.x, p.y - previous.y);
        return;
      }

      const before = firstTwo();
      pointers.set(p.id, p);
      const after = firstTwo();
      if (!before || !after) return;

      const startDistance = distance(...before);
      const scale = startDistance > 0 ? distance(...after) / startDistance : 1;
      handlers.pinch(midpoint(...before), midpoint(...after), scale);
    },

    up(p) {
      const candidate = tapCandidate;
      pointers.delete(p.id);
      tapCandidate = null;
      if (
        candidate?.id === p.id &&
        distance(candidate, p) <= options.tapSlop &&
        p.time - candidate.time <= options.tapMaxMs
      ) {
        handlers.tap({ x: p.x, y: p.y });
      }
    },

    cancel(id) {
      pointers.delete(id);
      tapCandidate = null;
    },
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
