import { expect, type Page, type TestInfo } from '@playwright/test';
import { defaultContent } from '@voltiris/content';
import { worldToScreen } from '../src/iso/camera';
import { createLayout, WALL_HEIGHT, type BuildingId } from '../src/iso/layout';
import { gridToWorld, tileCenter, type Point } from '../src/iso/projection';
import { firstView } from '../src/iso/view';

// Screen positions come from the game's own layout and camera maths, for the
// opening view (before any pan or zoom).

const layout = createLayout(defaultContent.greenhouse.sizes[0]?.plots ?? 0);

function openingView(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('The page has no viewport');
  return (world: Point) =>
    worldToScreen(world, firstView(layout, viewport), viewport);
}

/** Opens the game and waits for the map and the HUD. */
export async function openGame(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Temperature' })).toBeVisible();
}

export function plotOnScreen(page: Page, index: number): Point {
  const tile = layout.plots[index];
  if (!tile) throw new Error(`No plot ${index}`);
  return openingView(page)(tileCenter(tile));
}

/** The middle of a building's walls. */
export function buildingOnScreen(page: Page, id: BuildingId): Point {
  const building = layout.buildings.find((b) => b.id === id);
  if (!building) throw new Error(`No building ${id}`);
  const { i, j, width, length } = building.footprint;
  const base = gridToWorld(i + width / 2, j + length / 2);
  return openingView(page)({ x: base.x, y: base.y - building.height / 3 });
}

/** High on the greenhouse glass, above the plots. */
export function greenhouseOnScreen(page: Page): Point {
  const { i, j, width, length } = layout.greenhouse;
  const middle = gridToWorld(i + width / 2, j + length / 2);
  return openingView(page)({ x: middle.x, y: middle.y - WALL_HEIGHT });
}

/** Lawn in the front yard, with nothing on it. */
export function lawnOnScreen(page: Page): Point {
  return openingView(page)(tileCenter({ i: 9, j: 8 }));
}

export function forSaleSignOnScreen(page: Page): Point {
  const sign = layout.forSale[0];
  if (!sign) throw new Error('No For sale sign');
  const foot = tileCenter(sign);
  return openingView(page)({ x: foot.x, y: foot.y - 48 });
}

/** A finger tap. */
export async function tap(page: Page, p: Point): Promise<void> {
  await page.touchscreen.tap(p.x, p.y);
}

/** Page crashes and console errors; a test fails if any show up. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

/** A screenshot for people to look at, kept with the test results. */
export async function snapshot(
  page: Page,
  info: TestInfo,
  name: string,
): Promise<void> {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: 'image/png' });
}
