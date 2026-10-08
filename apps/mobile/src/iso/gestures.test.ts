import { describe, expect, it, vi } from 'vitest';
import { createGestureTracker } from './gestures';

function setup() {
  const handlers = { pan: vi.fn(), pinch: vi.fn(), tap: vi.fn() };
  return { handlers, tracker: createGestureTracker(handlers) };
}

const at = (id: number, x: number, y: number, time = 0) => ({ id, x, y, time });

describe('gesture tracker', () => {
  it('turns a one-finger drag into pans', () => {
    const { handlers, tracker } = setup();
    tracker.down(at(1, 100, 100));
    tracker.move(at(1, 130, 90));
    tracker.move(at(1, 150, 95));
    tracker.up(at(1, 150, 95, 300));
    expect(handlers.pan.mock.calls).toEqual([
      [30, -10],
      [20, 5],
    ]);
    expect(handlers.tap).not.toHaveBeenCalled();
  });

  it('reports a short, still press as a tap', () => {
    const { handlers, tracker } = setup();
    tracker.down(at(1, 200, 150, 1000));
    tracker.move(at(1, 203, 152, 1050));
    tracker.up(at(1, 203, 152, 1150));
    expect(handlers.tap).toHaveBeenCalledWith({ x: 203, y: 152 });
  });

  it('does not tap after a long press or a drag', () => {
    const { handlers, tracker } = setup();
    tracker.down(at(1, 200, 150, 0));
    tracker.up(at(1, 200, 150, 900));
    tracker.down(at(2, 200, 150, 1000));
    tracker.move(at(2, 240, 150, 1050));
    tracker.move(at(2, 200, 150, 1100));
    tracker.up(at(2, 200, 150, 1150));
    expect(handlers.tap).not.toHaveBeenCalled();
  });

  it('turns two fingers spreading apart into a pinch zoom', () => {
    const { handlers, tracker } = setup();
    tracker.down(at(1, 100, 200));
    tracker.down(at(2, 200, 200));
    tracker.move(at(2, 300, 200));
    expect(handlers.pinch).toHaveBeenCalledWith(
      { x: 150, y: 200 },
      { x: 200, y: 200 },
      2,
    );
    expect(handlers.pan).not.toHaveBeenCalled();
  });

  it('does not tap when a second finger joins', () => {
    const { handlers, tracker } = setup();
    tracker.down(at(1, 100, 200, 0));
    tracker.down(at(2, 200, 200, 10));
    tracker.up(at(2, 200, 200, 50));
    tracker.up(at(1, 100, 200, 60));
    expect(handlers.tap).not.toHaveBeenCalled();
  });

  it('keeps panning smoothly with the finger left after a pinch', () => {
    const { handlers, tracker } = setup();
    tracker.down(at(1, 100, 200));
    tracker.down(at(2, 200, 200));
    tracker.up(at(2, 200, 200));
    tracker.move(at(1, 110, 205));
    expect(handlers.pan).toHaveBeenCalledWith(10, 5);
  });

  it('ignores moves from pointers it never saw go down', () => {
    const { handlers, tracker } = setup();
    tracker.move(at(9, 10, 10));
    expect(handlers.pan).not.toHaveBeenCalled();
  });
});
