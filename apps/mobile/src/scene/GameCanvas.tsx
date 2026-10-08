import { Application, extend } from '@pixi/react';
import type { CropDef, CropId } from '@voltiris/content';
import { growthProgress, type Greenhouse, type Planting } from '@voltiris/sim';
import {
  Container,
  Graphics,
  Text,
  type Application as PixiApp,
  type TextStyleOptions,
} from 'pixi.js';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame, useGameStore } from '../game/context';
import type { BubbleAnchor } from '../game/store';
import {
  createLayout,
  targetAt,
  type Building,
  type BuildingId,
  type SceneLayout,
} from '../iso/layout';
import {
  depth,
  TILE_HEIGHT,
  tileCenter,
  type GridPoint,
  type Point,
} from '../iso/projection';
import {
  sceneItems,
  scatterScenery,
  type FlatKind,
  type SceneItem,
  type Scenery,
} from '../iso/scenery';
import { BUILDING_INFO } from '../ui/buildingInfo';
import { drawBuilding } from './draw/buildings';
import { drawEquipment, EQUIPMENT_SHAPES } from './draw/equipment';
import { drawGround } from './draw/ground';
import { drawGreenhouseBack, drawGreenhouseFront } from './draw/greenhouse';
import {
  drawPlant,
  drawPlot,
  plantHeight,
  type PlantLook,
} from './draw/plants';
import {
  drawFence,
  drawSignBoard,
  drawStanding,
  signTextCenter,
} from './draw/scenery';
import { at } from './draw/shapes';
import styles from './GameCanvas.module.css';
import { COLORS } from './palette';
import { useCamera, type CameraEvents, type ToScreen } from './useCamera';

extend({ Container, Graphics, Text });

/** Plant drawings change in 5% steps, so plants redraw at most 20 times. */
const PROGRESS_STEPS = 20;
const MAX_RESOLUTION = 2;
/** Screen space the HUD covers, so the first view centres the yard beside it. */
const HUD_INSETS = { top: 52, right: 0, bottom: 0, left: 124 } as const;

const SIGN_TEXT: TextStyleOptions = {
  fontFamily: 'Fredoka Variable, system-ui, sans-serif',
  fontSize: 15,
  fontWeight: '700',
  fill: COLORS.signRed,
  letterSpacing: 0.5,
};

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

/** Where a plot's bubble points: above its plant, or below the plot. */
function bubbleAnchor(
  tile: GridPoint,
  plantTop: number,
  toScreen: ToScreen,
): BubbleAnchor {
  const c = tileCenter(tile);
  const top = toScreen({
    x: c.x,
    y: c.y - Math.max(plantTop, TILE_HEIGHT / 2),
  });
  const bottom = toScreen({ x: c.x, y: c.y + TILE_HEIGHT / 2 });
  return { x: top.x, top: top.y, bottom: bottom.y };
}

/** World point just above a building, where its name tag hangs. */
function labelAnchor({ footprint: f, height }: Building): Point {
  return at(f.i + f.width / 2, f.j + f.length / 2, height + 10);
}

type SceneRun =
  | { readonly kind: 'static'; readonly items: readonly SceneItem[] }
  | { readonly kind: 'greenhouse' }
  | { readonly kind: 'sign'; readonly tile: GridPoint };

/** Back-to-front scene, with neighbouring static items merged into one drawing. */
function buildScene(layout: SceneLayout, debug: boolean) {
  const { standing, flat } = scatterScenery(layout);
  const items = sceneItems(
    layout,
    standing,
    debug ? EQUIPMENT_SHAPES.length : 0,
  );
  const runs: SceneRun[] = [];
  for (const item of items) {
    if (item.kind === 'greenhouse' || item.kind === 'sign') {
      runs.push(item);
      continue;
    }
    const last = runs[runs.length - 1];
    if (last?.kind === 'static')
      runs[runs.length - 1] = { kind: 'static', items: [...last.items, item] };
    else runs.push({ kind: 'static', items: [item] });
  }
  return { flat, runs };
}

export function GameCanvas({ debug = false }: { debug?: boolean }) {
  const greenhouse = useGame((s) => s.game.greenhouses[0]);
  const crops = useGame((s) => s.content.crops);
  const selectedPlotId = useGame((s) => s.selection?.plotId ?? null);
  const store = useGameStore();

  const plotCount = greenhouse?.plots.length ?? 0;
  const layout = useMemo(() => createLayout(plotCount), [plotCount]);
  const scene = useMemo(() => buildScene(layout, debug), [layout, debug]);
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef(new Map<BuildingId, HTMLElement>());
  const [app, setApp] = useState<PixiApp | null>(null);

  const events = useMemo<CameraEvents>(
    () => ({
      onTap: (world, toScreen) => {
        const { selectPlot, openWindow, notify } = store.getState();
        const plots = greenhouse?.plots ?? [];
        const heights = plots.map((p) => {
          const look = plantLook(p.planting, crops);
          return look ? plantHeight(look) : 0;
        });
        const target = targetAt(layout, world, heights);
        if (target?.kind === 'plot') {
          const plot = plots[target.index];
          const tile = layout.plots[target.index];
          if (!plot || !tile) return;
          selectPlot({
            plotId: plot.id,
            anchor: bubbleAnchor(tile, heights[target.index] ?? 0, toScreen),
          });
        } else if (target?.kind === 'building') {
          openWindow(target.id);
        } else {
          selectPlot(null);
          if (target?.kind === 'forSale') {
            notify(
              'This land is for sale. Buying land comes in a later update.',
            );
          }
        }
      },
      onMove: () => {
        if (store.getState().selection) store.getState().selectPlot(null);
      },
      onChange: (toScreen) => {
        for (const building of layout.buildings) {
          const label = labelsRef.current.get(building.id);
          if (!label) continue;
          const p = toScreen(labelAnchor(building));
          label.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        }
      },
    }),
    [store, greenhouse, crops, layout],
  );
  const { setContainer, handlers } = useCamera(
    hostRef,
    layout,
    events,
    HUD_INSETS,
  );

  return (
    <div ref={hostRef} className={styles.host} {...handlers}>
      <Application
        resizeTo={hostRef}
        background={COLORS.meadow}
        antialias
        autoDensity
        resolution={Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION)}
        onInit={setApp}
      >
        <pixiContainer ref={setContainer}>
          <Ground layout={layout} details={scene.flat} />
          {scene.runs.map((run, k) => {
            switch (run.kind) {
              case 'static':
                return <StaticRun key={k} items={run.items} />;
              case 'greenhouse':
                return greenhouse ? (
                  <GreenhouseView
                    key={k}
                    greenhouse={greenhouse}
                    crops={crops}
                    layout={layout}
                    selectedPlotId={selectedPlotId}
                  />
                ) : null;
              case 'sign':
                return <ForSaleSign key={k} tile={run.tile} />;
            }
          })}
        </pixiContainer>
      </Application>
      <div className={styles.labels}>
        {layout.buildings.map(({ id }) => (
          <button
            key={id}
            ref={(el) => {
              if (el) labelsRef.current.set(id, el);
              else labelsRef.current.delete(id);
            }}
            type="button"
            className={styles.label}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => store.getState().openWindow(id)}
          >
            {BUILDING_INFO[id].title}
            <span className={styles.soon}>Soon</span>
          </button>
        ))}
      </div>
      {debug && <FpsMeter app={app} />}
    </div>
  );
}

const Ground = memo(function Ground({
  layout,
  details,
}: {
  layout: SceneLayout;
  details: readonly Scenery<FlatKind>[];
}) {
  const draw = useCallback(
    (g: Graphics) => drawGround(g, layout, details),
    [layout, details],
  );
  return <pixiGraphics draw={draw} />;
});

/** Standing things that never change, drawn together in one Graphics. */
const StaticRun = memo(function StaticRun({
  items,
}: {
  items: readonly SceneItem[];
}) {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      for (const item of items) {
        switch (item.kind) {
          case 'scenery':
            drawStanding(g, item.scenery);
            break;
          case 'fence':
            drawFence(g, item.segment);
            break;
          case 'building':
            drawBuilding(g, item.building);
            break;
          case 'equipment': {
            const shape = EQUIPMENT_SHAPES[item.index];
            if (shape) drawEquipment(g, shape, tileCenter(item.tile));
            break;
          }
        }
      }
    },
    [items],
  );
  return <pixiGraphics draw={draw} />;
});

const ForSaleSign = memo(function ForSaleSign({ tile }: { tile: GridPoint }) {
  const foot = useMemo(() => tileCenter(tile), [tile]);
  const text = signTextCenter(foot);
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      drawSignBoard(g, foot);
    },
    [foot],
  );
  return (
    <pixiContainer>
      <pixiGraphics draw={draw} />
      <pixiText
        text="FOR SALE"
        anchor={0.5}
        x={text.x}
        y={text.y}
        style={SIGN_TEXT}
        resolution={2}
      />
    </pixiContainer>
  );
});

function GreenhouseView({
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

  return (
    <pixiContainer>
      <GreenhouseBack layout={layout} />
      {plots.map(({ plot, tile }) => {
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
      })}
      <GreenhouseFront layout={layout} />
    </pixiContainer>
  );
}

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
