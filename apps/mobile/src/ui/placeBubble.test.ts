import { describe, expect, it } from 'vitest';
import { placeBubble } from './placeBubble';

const SCREEN = 393;

describe('placeBubble', () => {
  it('opens above a plot with room above it, its tail on the plot', () => {
    const place = placeBubble({ x: 500, top: 260, bottom: 320 }, SCREEN);
    expect(place.side).toBe('above');
    expect(place.bubble).toMatchObject({
      bottom: 'calc(100% - 246px)',
      maxHeight: 238,
    });
    expect(place.tail).toEqual({ left: 500, top: 246 });
  });

  it('opens below a plot near the top of the screen', () => {
    const place = placeBubble({ x: 120, top: 90, bottom: 150 }, SCREEN);
    expect(place.side).toBe('below');
    expect(place.bubble).toMatchObject({ top: 164 });
    expect(place.tail).toEqual({ left: 120, top: 164 });
  });

  it('opens on the roomier side when neither has plenty of room', () => {
    // A small phone: 180 px above the plot, 145 px below it.
    expect(placeBubble({ x: 300, top: 180, bottom: 230 }, 375).side).toBe(
      'above',
    );
    expect(placeBubble({ x: 300, top: 120, bottom: 170 }, 375).side).toBe(
      'below',
    );
  });

  it('centres on the plot but stays inside the screen edges', () => {
    const { bubble } = placeBubble({ x: 20, top: 400, bottom: 460 }, 600);
    expect(bubble.left).toBe(
      'clamp(var(--edge-left), -150px, calc(100% - 340px - var(--edge-right)))',
    );
  });
});
