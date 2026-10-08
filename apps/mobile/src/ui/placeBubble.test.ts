import { describe, expect, it } from 'vitest';
import { placeBubble } from './placeBubble';

describe('placeBubble', () => {
  it('opens above a plot with room above it, its tail on the plot', () => {
    const place = placeBubble({ x: 500, top: 260, bottom: 320 });
    expect(place.side).toBe('above');
    expect(place.bubble).toMatchObject({
      bottom: 'calc(100% - 246px)',
      maxHeight: 238,
    });
    expect(place.tail).toEqual({ left: 500, top: 246 });
  });

  it('opens below a plot near the top of the screen', () => {
    const place = placeBubble({ x: 120, top: 90, bottom: 150 });
    expect(place.side).toBe('below');
    expect(place.bubble).toMatchObject({ top: 164 });
    expect(place.tail).toEqual({ left: 120, top: 164 });
  });

  it('centres on the plot but stays inside the screen edges', () => {
    const { bubble } = placeBubble({ x: 20, top: 400, bottom: 460 });
    expect(bubble.left).toBe(
      'clamp(var(--edge-left), -130px, calc(100% - 300px - var(--edge-right)))',
    );
  });
});
