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
  fitCamera,
  panCamera,
  pinchCamera,
  screenToWorld,
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
import {
  greenhouseBounds,
  groundBounds,
  type SceneLayout,
} from '../iso/layout';
import type { Point } from '../iso/projection';

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const WHEEL_ZOOM_SPEED = 0.0015;

/**
 * Pan, pinch-zoom and tap handling for the world container. The camera lives
 * in refs and is written straight to the Pixi container, so gestures never
 * re-render React.
 */
export function useCamera(
  hostRef: RefObject<HTMLDivElement | null>,
  layout: SceneLayout,
  onTapWorld: (world: Point) => void,
) {
  const containerRef = useRef<Container | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const viewportRef = useRef<Viewport>({ width: 0, height: 0 });

  const limits = useMemo<CameraLimits>(
    () => ({
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      bounds: groundBounds(layout),
    }),
    [layout],
  );
  const limitsRef = useRef(limits);
  const onTapRef = useRef(onTapWorld);
  useEffect(() => {
    limitsRef.current = limits;
    onTapRef.current = onTapWorld;
  }, [limits, onTapWorld]);

  const apply = useCallback(() => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;
    const t = containerTransform(camera, viewportRef.current);
    container.position.set(t.x, t.y);
    container.scale.set(t.scale);
  }, []);

  const update = useCallback(
    (next: (camera: Camera) => Camera) => {
      const camera = cameraRef.current;
      if (!camera) return;
      cameraRef.current = next(camera);
      apply();
    },
    [apply],
  );

  // Fit the greenhouse on first layout, then keep the camera valid on resize.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onResize = () => {
      const viewport = { width: host.clientWidth, height: host.clientHeight };
      if (viewport.width === 0 || viewport.height === 0) return;
      viewportRef.current = viewport;
      cameraRef.current = cameraRef.current
        ? clampCamera(cameraRef.current, limits)
        : fitCamera(greenhouseBounds(layout), viewport, limits);
      apply();
    };
    onResize();
    const observer = new ResizeObserver(onResize);
    observer.observe(host);
    return () => observer.disconnect();
  }, [hostRef, layout, limits, apply]);

  const trackerRef = useRef<GestureTracker | null>(null);
  useEffect(() => {
    trackerRef.current = createGestureTracker({
      pan: (dx, dy) =>
        update((cam) => panCamera(cam, dx, dy, limitsRef.current)),
      pinch: (from, to, scale) =>
        update((cam) =>
          pinchCamera(
            cam,
            viewportRef.current,
            from,
            to,
            scale,
            limitsRef.current,
          ),
        ),
      tap: (point) => {
        const camera = cameraRef.current;
        if (camera) {
          onTapRef.current(screenToWorld(point, camera, viewportRef.current));
        }
      },
    });
    return () => {
      trackerRef.current = null;
    };
  }, [update]);

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
      update((cam) =>
        zoomCameraAt(
          cam,
          viewportRef.current,
          point,
          factor,
          limitsRef.current,
        ),
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
