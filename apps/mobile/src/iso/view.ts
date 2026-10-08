import {
  fitCamera,
  fitZoom,
  type Camera,
  type CameraLimits,
  type Insets,
  type Viewport,
} from './camera';
import { clampToLot, lotBounds, yardBounds, type SceneLayout } from './layout';

const MAX_ZOOM = 2.5;

/** Screen space the HUD covers, so the first view centres the yard beside it. */
const HUD_INSETS: Insets = { top: 52, right: 0, bottom: 0, left: 124 };
const FIRST_VIEW_PADDING = 8;

/**
 * The camera stays over the player's lot. It zooms out until the whole lot
 * fits on screen, or the whole yard fits beside the HUD, whichever is further.
 */
export function cameraLimits(
  layout: SceneLayout,
  viewport: Viewport,
): CameraLimits {
  return {
    minZoom: Math.min(
      1,
      fitZoom(lotBounds(layout), viewport.width, viewport.height),
      yardZoom(layout, viewport),
    ),
    maxZoom: MAX_ZOOM,
    clampCenter: clampToLot(layout),
  };
}

/** The view when the game opens: the whole yard, beside the HUD. */
export function firstView(layout: SceneLayout, viewport: Viewport): Camera {
  return fitCamera(
    yardBounds(layout),
    viewport,
    cameraLimits(layout, viewport),
    FIRST_VIEW_PADDING,
    HUD_INSETS,
  );
}

/** The zoom at which the whole yard fits beside the HUD. */
function yardZoom(layout: SceneLayout, viewport: Viewport): number {
  const { top, right, bottom, left } = HUD_INSETS;
  return fitZoom(
    yardBounds(layout),
    viewport.width - left - right - 2 * FIRST_VIEW_PADDING,
    viewport.height - top - bottom - 2 * FIRST_VIEW_PADDING,
  );
}
