import type { Container } from 'pixi.js';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PointerEvent,
  type RefObject,
} from 'react';
import {
  clampCamera,
  containerTransform,
  panCamera,
  pinchCamera,
  screenToWorld,
  worldToScreen,
  zoomCameraAt,
  type Camera,
  type CameraLimits,
  type Viewport,
} from '../iso/camera';
import {
  createGestureTracker,
  type GestureTracker,
  type PointerSample,
} from '../iso/gestures';
import type { SceneLayout } from '../iso/layout';
import type { Point } from '../iso/projection';
import { cameraLimits, firstView } from '../iso/view';

const WHEEL_ZOOM_SPEED = 0.0015;

export type ToScreen = (world: Point) => Point;

export interface CameraEvents {
  /** A tap, in world coordinates. */
  readonly onTap: (world: Point, toScreen: ToScreen) => void;
  /** The view was panned, zoomed or resized. */
  readonly onMove: () => void;
  /** After every camera change: where world points now are on screen. */
  readonly onChange: (toScreen: ToScreen) => void;
}

/**
 * Pan, pinch-zoom and tap handling for the world container. The camera stays
 * over the player's lot, and zooms out no further than showing all of it. It
 * lives in refs and is written straight to the Pixi container, so gestures
 * never re-render React.
 */
export function useCamera(
  hostRef: RefObject<HTMLDivElement | null>,
  layout: SceneLayout,
  events: CameraEvents,
) {
  const containerRef = useRef<Container | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const viewportRef = useRef<Viewport>({ width: 0, height: 0 });
  const limitsRef = useRef<CameraLimits | null>(null);
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const toScreen = useCallback<ToScreen>((world) => {
    const camera = cameraRef.current;
    return camera ? worldToScreen(world, camera, viewportRef.current) : world;
  }, []);

  const apply = useCallback(() => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;
    const t = containerTransform(camera, viewportRef.current);
    container.position.set(t.x, t.y);
    container.scale.set(t.scale);
    eventsRef.current.onChange(toScreen);
  }, [toScreen]);

  const update = useCallback(
    (next: (camera: Camera, limits: CameraLimits) => Camera) => {
      const camera = cameraRef.current;
      const limits = limitsRef.current;
      if (!camera || !limits) return;
      cameraRef.current = next(camera, limits);
      apply();
      eventsRef.current.onMove();
    },
    [apply],
  );

  // Show the whole yard at first; keep the camera valid on resize.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onResize = () => {
      const viewport = { width: host.clientWidth, height: host.clientHeight };
      if (viewport.width === 0 || viewport.height === 0) return;
      const limits = cameraLimits(layout, viewport);
      viewportRef.current = viewport;
      limitsRef.current = limits;
      cameraRef.current = cameraRef.current
        ? clampCamera(cameraRef.current, limits)
        : firstView(layout, viewport);
      apply();
      eventsRef.current.onMove();
    };
    onResize();
    const observer = new ResizeObserver(onResize);
    observer.observe(host);
    return () => observer.disconnect();
  }, [hostRef, layout, apply]);

  const trackerRef = useRef<GestureTracker | null>(null);
  useEffect(() => {
    trackerRef.current = createGestureTracker({
      pan: (dx, dy) => update((cam, limits) => panCamera(cam, dx, dy, limits)),
      pinch: (from, to, scale) =>
        update((cam, limits) =>
          pinchCamera(cam, viewportRef.current, from, to, scale, limits),
        ),
      tap: (point) => {
        const camera = cameraRef.current;
        if (camera) {
          eventsRef.current.onTap(
            screenToWorld(point, camera, viewportRef.current),
            toScreen,
          );
        }
      },
    });
    return () => {
      trackerRef.current = null;
    };
  }, [update, toScreen]);

  // Native, non-passive wheel listener: React's onWheel is passive, so it
  // cannot stop a trackpad pinch (ctrl+wheel) from also zooming the page.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_SPEED);
      update((cam, limits) =>
        zoomCameraAt(cam, viewportRef.current, point, factor, limits),
      );
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, [hostRef, update]);

  const setContainer = useCallback(
    (container: Container | null) => {
      containerRef.current = container;
      apply();
    },
    [apply],
  );

  const handlers = useMemo(() => {
    const sample = (e: PointerEvent<HTMLDivElement>): PointerSample => {
      const rect = e.currentTarget.getBoundingClientRect();
      return {
        id: e.pointerId,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        time: e.timeStamp,
      };
    };
    return {
      onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        trackerRef.current?.down(sample(e));
      },
      onPointerMove: (e: PointerEvent<HTMLDivElement>) =>
        trackerRef.current?.move(sample(e)),
      onPointerUp: (e: PointerEvent<HTMLDivElement>) =>
        trackerRef.current?.up(sample(e)),
      onPointerCancel: (e: PointerEvent<HTMLDivElement>) =>
        trackerRef.current?.cancel(e.pointerId),
    };
  }, []);

  return { setContainer, handlers };
}
