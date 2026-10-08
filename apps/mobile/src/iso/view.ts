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

/**
 * The camera stays over the player's lot and zooms out no further than the
 * whole lot fitting on screen.
 */
export function cameraLimits(
  layout: SceneLayout,
  viewport: Viewport,
): CameraLimits {
  return {
    minZoom: Math.min(
      1,
      fitZoom(lotBounds(layout), viewport.width, viewport.height),
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
    8,
    HUD_INSETS,
  );
}
