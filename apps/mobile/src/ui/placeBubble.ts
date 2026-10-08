import type { CSSProperties } from 'react';
import type { BubbleAnchor } from '../game/store';

export const BUBBLE_WIDTH = 300;
/** Space above the plot a bubble needs; with less it opens below. */
const ROOM_ABOVE = 210;
/** Gap between the plot and the bubble, where the tail sits. */
const GAP = 14;
const MARGIN = 8;

export interface BubblePlacement {
  readonly side: 'above' | 'below';
  readonly bubble: CSSProperties;
  readonly tail: CSSProperties;
}

/**
 * Where a plot's bubble and its tail go: above the plot when there is room,
 * otherwise below it, kept inside the screen's safe edges.
 */
export function placeBubble(anchor: BubbleAnchor): BubblePlacement {
  const left = `clamp(var(--edge-left), ${anchor.x - BUBBLE_WIDTH / 2}px, calc(100% - ${BUBBLE_WIDTH}px - var(--edge-right)))`;
  if (anchor.top >= ROOM_ABOVE) {
    return {
      side: 'above',
      bubble: {
        left,
        bottom: `calc(100% - ${anchor.top - GAP}px)`,
        maxHeight: anchor.top - GAP - MARGIN,
      },
      tail: { left: anchor.x, top: anchor.top - GAP },
    };
  }
  return {
    side: 'below',
    bubble: {
      left,
      top: anchor.bottom + GAP,
      maxHeight: `calc(100% - ${anchor.bottom + GAP + MARGIN}px)`,
    },
    tail: { left: anchor.x, top: anchor.bottom + GAP },
  };
}
