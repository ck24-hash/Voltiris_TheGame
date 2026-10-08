import { CROP_IDS } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { plantHeight } from './plants';

describe('plantHeight', () => {
  it.each(CROP_IDS)('grows with %s progress, and ripe is tallest', (cropId) => {
    const heights = [0, 0.1, 0.3, 0.6, 0.95].map((progress) =>
      plantHeight({ cropId, progress, ready: false }),
    );
    for (let k = 1; k < heights.length; k++) {
      expect(heights[k]).toBeGreaterThanOrEqual(heights[k - 1] ?? 0);
    }
    const ripe = plantHeight({ cropId, progress: 1, ready: true });
    expect(ripe).toBeGreaterThanOrEqual(heights[heights.length - 1] ?? 0);
  });

  it('keeps seedlings small so they do not cover nearby tiles', () => {
    expect(plantHeight({ cropId: 'tomato', progress: 0, ready: false })).toBe(
      20,
    );
  });
});
