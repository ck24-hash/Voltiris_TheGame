import { Application, extend } from '@pixi/react';
import type { CropDef, CropId } from '@voltiris/content';
import { growthProgress, type Greenhouse, type Planting } from '@voltiris/sim';
import { Container, Graphics, type Application as PixiApp } from 'pixi.js';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../game/context';
import { createLayout, plotIndexAt, type SceneLayout } from '../iso/layout';
import {
  depth,
  tileCenter,
  type GridPoint,
  type Point,
} from '../iso/projection';
import {
  drawEquipment,
  EQUIPMENT_SHAPES,
  type EquipmentShape,
} from './draw/equipment';
import { drawGround } from './draw/ground';
import { drawGreenhouseBack, drawGreenhouseFront } from './draw/greenhouse';
import {
  drawPlant,
  drawPlot,
  plantHeight,
  type PlantLook,
} from './draw/plants';
import styles from './GameCanvas.module.css';
import { COLORS } from './palette';
import { useCamera } from './useCamera';

extend({ Container, Graphics });

/** Plant drawings change in 5% steps, so plants redraw at most 20 times. */
const PROGRESS_STEPS = 20;
const MAX_RESOLUTION = 2;

/** What to draw for a planting; shared by drawing and tap targets. */
function plantLook(
  planting: Planting | null,
  crops: Readonly<Record<CropId, CropDef>>,
): PlantLook | null {
  if (!planting) return null;
  const progress = growthProgress(planting, crops[planting.cropId]);
  return {
    cropId: planting.cropId,
    progress: Math.floor(progress * PROGRESS_STEPS) / PROGRESS_STEPS,
    ready: planting.status === 'ready',
  };
}

export function GameCanvas({ debug = false }: { debug?: boolean }) {
  const greenhouse = useGame((s) => s.game.greenhouses[0]);
  const crops = useGame((s) => s.content.crops);
  const selectedPlotId = useGame((s) => s.selectedPlotId);
  const selectPlot = useGame((s) => s.selectPlot);

  const plotCount = greenhouse?.plots.length ?? 0;
  const layout = useMemo(() => createLayout(plotCount), [plotCount]);
  const hostRef = useRef<HTMLDivElement>(null);
  const [app, setApp] = useState<PixiApp | null>(null);

  const onTapWorld = useCallback(
    (world: Point) => {
      const plots = greenhouse?.plots ?? [];
      const heights = plots.map((p) => {
        const look = plantLook(p.planting, crops);
        return look ? plantHeight(look) : 0;
      });
      const index = plotIndexAt(layout, world, heights);
      selectPlot(index === null ? null : (plots[index]?.id ?? null));
    },
    [layout, greenhouse, crops, selectPlot],
  );
  const { setContainer, handlers } = useCamera(hostRef, layout, onTapWorld);

  return (
    <div ref={hostRef} className={styles.host} {...handlers}>
      <Application
        resizeTo={hostRef}
        background={COLORS.sky}
        antialias
        autoDensity
        resolution={Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION)}
        onInit={setApp}
      >
        <pixiContainer ref={setContainer}>
          <Ground layout={layout} />
          <GreenhouseBack layout={layout} />
          {greenhouse && (
            <Plots
              greenhouse={greenhouse}
              crops={crops}
              layout={layout}
              selectedPlotId={selectedPlotId}
            />
          )}
          <GreenhouseFront layout={layout} />
          {debug && <EquipmentPreview layout={layout} />}
        </pixiContainer>
      </Application>
      {debug && <FpsMeter app={app} />}
    </div>
  );
}

const Ground = memo(function Ground({ layout }: { layout: SceneLayout }) {
  const draw = useCallback((g: Graphics) => drawGround(g, layout), [layout]);
  return <pixiGraphics draw={draw} />;
});

const GreenhouseBack = memo(function GreenhouseBack({
  layout,
}: {
  layout: SceneLayout;
}) {
  const draw = useCallback(
    (g: Graphics) => drawGreenhouseBack(g, layout.greenhouse),
    [layout],
  );
  return <pixiGraphics draw={draw} />;
});

const GreenhouseFront = memo(function GreenhouseFront({
  layout,
}: {
  layout: SceneLayout;
}) {
  const draw = useCallback(
    (g: Graphics) => drawGreenhouseFront(g, layout.greenhouse),
    [layout],
  );
  return <pixiGraphics draw={draw} />;
});

function Plots({
  greenhouse,
  crops,
  layout,
  selectedPlotId,
}: {
  greenhouse: Greenhouse;
  crops: Readonly<Record<CropId, CropDef>>;
  layout: SceneLayout;
  selectedPlotId: string | null;
}) {
  const plots = greenhouse.plots
    .flatMap((plot, index) => {
      const tile = layout.plots[index];
      return tile ? [{ plot, tile }] : [];
    })
    .sort((a, b) => depth(a.tile) - depth(b.tile));

  return plots.map(({ plot, tile }) => {
    const look = plantLook(plot.planting, crops);
    // Primitive props keep PlotView's memo effective.
    return (
      <PlotView
        key={plot.id}
        tile={tile}
        selected={plot.id === selectedPlotId}
        cropId={look?.cropId ?? null}
        progress={look?.progress ?? 0}
        ready={look?.ready ?? false}
      />
    );
  });
}

const PlotView = memo(function PlotView({
  tile,
  selected,
  cropId,
  progress,
  ready,
}: {
  tile: GridPoint;
  selected: boolean;
  cropId: CropId | null;
  progress: number;
  ready: boolean;
}) {
  const center = tileCenter(tile);
  const drawSoil = useCallback(
    (g: Graphics) => drawPlot(g, selected),
    [selected],
  );
  const drawCrop = useCallback(
    (g: Graphics) => {
      if (cropId) drawPlant(g, { cropId, progress, ready });
      else g.clear();
    },
    [cropId, progress, ready],
  );
  return (
    <pixiContainer x={center.x} y={center.y}>
      <pixiGraphics draw={drawSoil} />
      <pixiGraphics draw={drawCrop} />
    </pixiContainer>
  );
});

/** Debug only: the equipment placeholders, on the grass in front of the greenhouse. */
function EquipmentPreview({ layout }: { layout: SceneLayout }) {
  const { i, j, width, length } = layout.greenhouse;
  return EQUIPMENT_SHAPES.map((shape, k) => {
    const center = tileCenter({
      i: i + width + 1,
      j: j + k + Math.max(0, length - 4),
    });
    return (
      <EquipmentView key={shape} shape={shape} x={center.x} y={center.y} />
    );
  });
}

function EquipmentView({
  shape,
  x,
  y,
}: {
  shape: EquipmentShape;
  x: number;
  y: number;
}) {
  const draw = useCallback((g: Graphics) => drawEquipment(g, shape), [shape]);
  return <pixiGraphics x={x} y={y} draw={draw} />;
}

/** Debug only: frames per second, on screen and in the console every 5 s. */
function FpsMeter({ app }: { app: PixiApp | null }) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!app) return;
    let samples = 0;
    const id = setInterval(() => {
      const value = app.ticker.FPS;
      setFps(value);
      samples += 1;
      if (samples % 10 === 0) console.info(`[fps] ${value.toFixed(1)}`);
    }, 500);
    return () => clearInterval(id);
  }, [app]);
  return <div className={styles.fps}>{fps.toFixed(0)} fps</div>;
}
