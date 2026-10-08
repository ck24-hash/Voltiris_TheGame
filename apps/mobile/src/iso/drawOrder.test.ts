import { describe, expect, it } from 'vitest';
import { boxAround, footprintBox, sortForDrawing, type Box } from './drawOrder';

interface Thing {
  readonly name: string;
  readonly box: Box;
}

const order = (things: Thing[]) =>
  sortForDrawing(things, (t) => t.box).map((t) => t.name);

describe('sortForDrawing', () => {
  it('draws whatever stands behind first', () => {
    const front = { name: 'front', box: boxAround(5, 5, 1) };
    const back = { name: 'back', box: boxAround(2, 5, 1) };
    expect(order([front, back])).toEqual(['back', 'front']);
  });

  it('gets a long greenhouse and a small shed right where one depth value fails', () => {
    // A 4×12 greenhouse with a 2×2 shed on its +i side, level with its back:
    // the shed's centre is shallower (14 vs 15), yet it stands in front.
    const greenhouse = {
      name: 'greenhouse',
      box: footprintBox({ i: 5, j: 2, width: 4, length: 12 }),
    };
    const shed = {
      name: 'shed',
      box: footprintBox({ i: 10, j: 2, width: 2, length: 2 }),
    };
    expect(order([shed, greenhouse])).toEqual(['greenhouse', 'shed']);
  });

  it('keeps objects side by side in depth order', () => {
    const left = { name: 'left', box: boxAround(1, 9, 1) };
    const right = { name: 'right', box: boxAround(9, 1.5, 1) };
    expect(order([right, left])).toEqual(['left', 'right']);
  });

  it('never drops anything, even with overlapping footprints', () => {
    const things = [0, 1, 2, 3].map((k) => ({
      name: `t${k}`,
      box: boxAround(3 + k * 0.3, 3 - k * 0.2, 1),
    }));
    expect(order(things).sort()).toEqual(['t0', 't1', 't2', 't3']);
  });
});
