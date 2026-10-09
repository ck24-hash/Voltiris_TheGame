import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  badge,
  badges,
  buildingOnScreen,
  collectErrors,
  forSaleSignOnScreen,
  greenhouseOnScreen,
  lawnOnScreen,
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

test('opens a new game with the guide', async ({ page }, info) => {
  await openGame(page, { keepGuide: true });
  const guide = page.getByRole('dialog', { name: 'How to play' });
  await expect(guide).toContainText('Microgreens are ready in 2 minutes');
  await snapshot(page, info, 'guide');
  await guide.getByRole('button', { name: /Let.s grow/ }).click();
  await expect(guide).toBeHidden();
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(guide).toBeVisible();
});

test('opens on the map with the HUD, the climate and the buildings', async ({
  page,
}, info) => {
  await openGame(page);
  await expect(page.getByText('Day 1 · 00:00')).toBeVisible();
  await expect(page.getByLabel('500 Volticoins')).toBeVisible();
  await expect(badges(page)).toHaveCount(5);
  for (const name of ['Greenhouse', 'Market', 'Storage', 'Energy', 'Village']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
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
  const last = await badges(page).last().boundingBox();
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
  await expect(badge(page, 'CO₂')).toContainText('Low');
  await snapshot(page, info, 'growing-bubble');
});

test('opens the game modes from the buildings on the map', async ({
  page,
}, info) => {
  await openGame(page);
  await tap(page, buildingOnScreen(page, 'market'));
  const market = page.getByRole('dialog', { name: 'Market' });
  await expect(market).toContainText('fixed price');
  await snapshot(page, info, 'market-window');
  await market.getByRole('button', { name: 'Close' }).click();
  await expect(market).toBeHidden();

  await tap(page, buildingOnScreen(page, 'storage'));
  const storage = page.getByRole('dialog', { name: 'Storage' });
  await expect(storage).toContainText('0 / 150 units');
  await storage.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Village', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Village' })).toContainText(
    'Town hall',
  );
});

// Phase 5 "Done when": a new player plants, harvests and sells, and makes a
// profit within the first 10 minutes.
test('plants, harvests and sells for a profit within minutes', async ({
  page,
}, info) => {
  // With the clock installed, WebKit on Linux takes its time to settle each
  // button before a tap; this test has many taps.
  test.slow();
  await page.clock.install({ time: new Date('2026-10-08T10:00:00Z') });
  await openGame(page);
  await tap(page, plotOnScreen(page, 0));
  const bubble = page.getByRole('dialog', { name: 'Plot 1' });
  await bubble.getByRole('button', { name: 'Plant Microgreens' }).click();
  await expect(page.getByLabel('497 Volticoins')).toBeVisible();

  // Microgreens take 2 minutes in the starting greenhouse.
  await page.clock.fastForward(3 * 60_000);
  await expect(bubble).toContainText('Ready!');
  await snapshot(page, info, 'ready-bubble');
  await bubble.getByRole('button', { name: 'Harvest' }).click();
  // The plot is free again.
  await expect(bubble).toContainText('Pick a seed');

  await tap(page, buildingOnScreen(page, 'market'));
  const market = page.getByRole('dialog', { name: 'Market' });
  await expect(market).toContainText('6 in storage');
  await snapshot(page, info, 'market-with-harvest');
  await market.getByRole('button', { name: 'Sell Microgreens' }).click();
  await expect(market).toContainText('None in storage');

  // The money label, not the toast, which may come and go before it is read.
  await expect
    .poll(async () =>
      Number(
        await page
          .getByLabel(/Volticoins$/)
          .first()
          .textContent(),
      ),
    )
    .toBeGreaterThan(500);
});

// Phase 6 "Done when": each piece of equipment visibly changes the climate
// and growth in the UI (the sim tests cover every piece; this is the heater).
test('buys a heater, and the greenhouse warms up for the cucumbers', async ({
  page,
}, info) => {
  // Many taps with the clock installed: see the harvest test above.
  test.slow();
  await page.clock.install({ time: new Date('2026-10-08T10:00:00Z') });
  await openGame(page);
  await tap(page, plotOnScreen(page, 0));
  const bubble = page.getByRole('dialog', { name: 'Plot 1' });
  await bubble.getByRole('button', { name: 'Plant Cucumber' }).click();
  await expect(bubble).toContainText('Too cold');
  const temperature = badge(page, 'Temperature');
  await expect(temperature).toContainText('20.0 °C');
  await expect(temperature).toHaveAttribute('data-status', 'warn');

  // Close the bubble, then tap the greenhouse itself.
  await tap(page, lawnOnScreen(page));
  await expect(bubble).toBeHidden();
  await tap(page, greenhouseOnScreen(page));
  const window = page.getByRole('dialog', { name: 'Greenhouse' });
  await window.getByRole('button', { name: /^Buy Heater/ }).click();
  await expect(page.getByLabel('344 Volticoins')).toBeVisible();
  await expect(window).toContainText('Heating · 75%');
  await snapshot(page, info, 'greenhouse-window');

  await window.getByRole('tab', { name: 'Climate' }).click();
  await expect(window.getByRole('group', { name: 'Heat up to' })).toContainText(
    '23.0 °C',
  );
  await window.getByRole('button', { name: 'Close' }).click();

  await page.clock.fastForward(3 * 60_000);
  await expect(temperature).toContainText('23.0 °C');
  await expect(temperature).toHaveAttribute('data-status', 'good');
  await tap(page, plotOnScreen(page, 0));
  await expect(bubble).not.toContainText('Too cold');
  await snapshot(page, info, 'warm-greenhouse');

  // A badge explains what the crop wants; the coins show the money.
  await tap(page, lawnOnScreen(page));
  await temperature.click();
  const help = page.getByRole('dialog', { name: 'Temperature' });
  await expect(help).toContainText('Ideal for Cucumber: 22–28 °C');
  await snapshot(page, info, 'climate-help');
  await help.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: /Volticoins$/ }).click();
  const money = page.getByRole('dialog', { name: 'Money' });
  await expect(money).toContainText('Running the greenhouse costs');
  await snapshot(page, info, 'money-window');
});

// Phase 7: solar panels make power by day, and the energy panel shows the
// flows and what they cost.
test('builds solar panels at the energy shed, which sell power by day', async ({
  page,
}, info) => {
  // Taps with the clock installed: see the harvest test above.
  test.slow();
  await page.clock.install({ time: new Date('2026-10-08T10:00:00Z') });
  await openGame(page);
  await tap(page, buildingOnScreen(page, 'energy'));
  const window = page.getByRole('dialog', { name: 'Energy' });
  await expect(window).toContainText('Night');
  await window.getByRole('tab', { name: 'Build' }).click();
  await window.getByRole('button', { name: /^Build Solar panels/ }).click();
  await expect(page.getByLabel('200 Volticoins')).toBeVisible();
  await window.getByRole('tab', { name: 'Now' }).click();
  await expect(
    window.getByRole('group', { name: 'Solar panels' }),
  ).toContainText('No sun now');

  // Midday: 12 game hours later.
  await page.clock.fastForward(3 * 60_000);
  await expect(
    window.getByRole('group', { name: 'Solar panels' }),
  ).toContainText('Making power');
  await expect(window.getByRole('group', { name: 'Grid' })).toContainText(
    'Selling spare power',
  );
  await snapshot(page, info, 'energy-window');
  await window.getByRole('button', { name: 'Close' }).click();
  await snapshot(page, info, 'energy-site');
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
  // The game opens twice, which takes a while where the map draws in software.
  test.slow();
  await page.clock.install({ time: new Date('2026-10-08T10:00:00Z') });
  await openGame(page);
  await tap(page, plotOnScreen(page, 1));
  await page.getByRole('button', { name: 'Plant Pepper' }).click();
  await expect(page.getByRole('dialog', { name: 'Plot 2' })).toContainText(
    'Growing',
  );
  // The save after an action is written straight away; give it a moment.
  await page.waitForTimeout(1000);
  const closedAt = await page.evaluate(() => Date.now());
  await page.close();

  // Two hours later, the player opens the game again.
  const later = await context.newPage();
  errors = collectErrors(later);
  await later.clock.setSystemTime(new Date(closedAt + 2 * HOUR));
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
  // A new game opens with the guide.
  const guide = page.getByRole('dialog', { name: 'How to play' });
  await guide.getByRole('button', { name: /Let.s grow/ }).click();
  await expect(guide).toBeHidden();

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
