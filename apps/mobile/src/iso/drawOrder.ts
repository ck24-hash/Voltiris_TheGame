import type { Footprint } from './layout';

/** The ground an object stands on, in grid units. */
export interface Box {
  readonly i0: number;
  readonly i1: number;
  readonly j0: number;
  readonly j1: number;
}

export function footprintBox(f: Footprint): Box {
  return { i0: f.i, i1: f.i + f.width, j0: f.j, j1: f.j + f.length };
}

/** A square box of `size` tiles centred on a grid point. */
export function boxAround(i: number, j: number, size: number): Box {
  const half = size / 2;
  return { i0: i - half, i1: i + half, j0: j - half, j1: j + half };
}

/** `a` lies entirely on the far side of `b` along i or along j. */
function isBehind(a: Box, b: Box): boolean {
  return a.i1 <= b.i0 || a.j1 <= b.j0;
}

function centreDepth(b: Box): number {
  return (b.i0 + b.i1 + b.j0 + b.j1) / 2;
}

/**
 * Orders objects back to front for drawing. Sorting by a single depth value
 * fails for objects of different sizes (a big greenhouse next to a small
 * shed), so this compares every pair: an object entirely behind another
 * along i or j is drawn first. Objects side by side on screen (behind each
 * other along different axes) never overlap and are left free.
 */
export function sortForDrawing<T>(
  items: readonly T[],
  boxOf: (item: T) => Box,
): T[] {
  const boxes = items.map(boxOf);
  const depths = boxes.map(centreDepth);
  const next: number[][] = items.map(() => []);
  const waitingFor = items.map(() => 0);

  const before = (first: number, second: number) => {
    next[first]?.push(second);
    waitingFor[second] = (waitingFor[second] ?? 0) + 1;
  };

  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const boxA = boxes[a];
      const boxB = boxes[b];
      if (!boxA || !boxB) continue;
      const aBehind = isBehind(boxA, boxB);
      const bBehind = isBehind(boxB, boxA);
      if (aBehind && !bBehind) before(a, b);
      else if (bBehind && !aBehind) before(b, a);
      else if (!aBehind && !bBehind) {
        // Overlapping footprints: fall back to depth.
        if ((depths[a] ?? 0) <= (depths[b] ?? 0)) before(a, b);
        else before(b, a);
      }
    }
  }

  // Kahn's algorithm, always taking the shallowest object that is free to go.
  const ready = new Set(items.flatMap((_, k) => (waitingFor[k] ? [] : [k])));
  const order: number[] = [];
  while (ready.size > 0) {
    let pick = -1;
    for (const k of ready) {
      if (pick === -1 || (depths[k] ?? 0) < (depths[pick] ?? 0)) pick = k;
    }
    ready.delete(pick);
    order.push(pick);
    for (const k of next[pick] ?? []) {
      waitingFor[k] = (waitingFor[k] ?? 0) - 1;
      if (waitingFor[k] === 0) ready.add(k);
    }
  }
  // Overlapping footprints could form a cycle; never drop anything.
  if (order.length < items.length) {
    const placed = new Set(order);
    const rest = items.flatMap((_, k) => (placed.has(k) ? [] : [k]));
    order.push(...rest.sort((a, b) => (depths[a] ?? 0) - (depths[b] ?? 0)));
  }
  return order.map((k) => items[k] as T);
}
