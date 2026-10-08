import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  buildingOnScreen,
  collectErrors,
  forSaleSignOnScreen,
  openGame,
  plotOnScreen,
  snapshot,
  tap,
} from './helpers';

const HOUR = 60 * 60 * 1000;

let errors: string[] = [];

test.beforeEach(({ page }) => {
  errors = collectErrors(page);
});

test.afterEach(() => {
  expect(errors, 'errors in the page').toEqual([]);
});

test('opens on the map with the HUD, the climate and the buildings', async ({
  page,
}, info) => {
  await openGame(page);
  await expect(page.getByText('Day 1 · 00:00')).toBeVisible();
  await expect(page.getByLabel('500 Volticoins')).toBeVisible();
  await expect(page.getByRole('group')).toHaveCount(6);
  for (const name of ['Market', 'Energy', 'Village']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  await snapshot(page, info, 'map');
});

test('fits the screen: no page scrolling, climate badges all visible', async ({
  page,
}) => {
  await openGame(page);
  const viewport = page.viewportSize();
  const fits = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <= window.innerWidth &&
      document.documentElement.scrollHeight <= window.innerHeight,
  );
  expect(fits).toBe(true);
  const last = await page.getByRole('group').last().boundingBox();
  expect(last && viewport && last.y + last.height).toBeLessThanOrEqual(
    viewport?.height ?? 0,
  );
});

test('plants a crop from the bubble at a tapped plot', async ({
  page,
}, info) => {
  await openGame(page);
  await tap(page, plotOnScreen(page, 0));
  const bubble = page.getByRole('dialog', { name: 'Plot 1' });
  await expect(bubble).toContainText('Pick a seed');
  await snapshot(page, info, 'seed-bubble');

  await bubble.getByRole('button', { name: 'Plant Tomato' }).click();
  await expect(bubble).toContainText('Growing');
  await expect(page.getByRole('group', { name: 'CO₂' })).toContainText('Low');
  await snapshot(page, info, 'growing-bubble');
});

test('opens the game modes from the buildings on the map', async ({
  page,
}, info) => {
  await openGame(page);
  await tap(page, buildingOnScreen(page, 'market'));
  const market = page.getByRole('dialog', { name: 'Market' });
  await expect(market).toContainText('Market stall');
  await snapshot(page, info, 'market-window');
  await market.getByRole('button', { name: 'Close' }).click();
  await expect(market).toBeHidden();

  await page.getByRole('button', { name: 'Village' }).click();
  await expect(page.getByRole('dialog', { name: 'Village' })).toContainText(
    'Town hall',
  );
});

test('says land for sale comes later', async ({ page }) => {
  await openGame(page);
  await tap(page, forSaleSignOnScreen(page));
  await expect(page.getByRole('status')).toContainText('This land is for sale');
});

test('keeps the game when the app closes and sums up the time away', async ({
  page,
  context,
}, info) => {
  const start = new Date('2026-10-08T10:00:00Z');
  await page.clock.install({ time: start });
  await openGame(page);
  await tap(page, plotOnScreen(page, 1));
  await page.getByRole('button', { name: 'Plant Pepper' }).click();
  await expect(page.getByRole('dialog', { name: 'Plot 2' })).toContainText(
    'Growing',
  );
  // The save after an action is written straight away; give it a moment.
  await page.waitForTimeout(1000);
  await page.close();

  // Two hours later, the player opens the game again.
  const later = await context.newPage();
  errors = collectErrors(later);
  await later.clock.setSystemTime(new Date(start.getTime() + 2 * HOUR));
  await openGame(later);
  const welcome = later.getByRole('dialog', { name: 'Welcome back!' });
  await expect(welcome).toContainText('You were away for 2 h');
  await snapshot(later, info, 'welcome-back');

  await welcome.getByRole('button', { name: /Let.s go/ }).click();
  await tap(later, plotOnScreen(later, 1));
  await expect(later.getByRole('dialog', { name: 'Plot 2' })).toContainText(
    'Pepper',
  );
});

test('exports the save and imports it again', async ({ page }, info) => {
  await openGame(page);
  await tap(page, plotOnScreen(page, 0));
  await page.getByRole('button', { name: 'Plant Tomato' }).click();

  await page.getByRole('button', { name: 'Settings' }).click();
  await snapshot(page, info, 'settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export save/ }).click();
  const file = info.outputPath('save.json');
  await (await download).saveAs(file);
  const saved = JSON.parse(await readFile(file, 'utf8')) as {
    format: string;
    game: {
      greenhouses: { plots: { planting: { cropId: string } | null }[] }[];
    };
  };
  expect(saved.format).toBe('voltiris-save');
  expect(saved.game.greenhouses[0]?.plots[0]?.planting?.cropId).toBe('tomato');

  // Start over, then bring the exported game back.
  await page.getByRole('button', { name: /New game/ }).click();
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByRole('status')).toContainText('New game started');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Import save/ }).click();
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Check save' }).click();
  await page.getByRole('button', { name: 'Replace my game' }).click();
  await expect(page.getByRole('status')).toContainText('Save imported');

  await tap(page, plotOnScreen(page, 0));
  await expect(page.getByRole('dialog', { name: 'Plot 1' })).toContainText(
    'Tomato',
  );
});
