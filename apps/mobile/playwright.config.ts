import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: the real production build in WebKit (Safari's engine, as
// on iPhone) and Chromium (as Android's WebView). Viewports are the phones'
// full landscape screens, since the app runs without browser bars.

const PORT = 4173;
const fullScreen = (width: number, height: number) => ({
  viewport: { width, height },
  screen: { width, height },
});

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: './e2e/results',
  fullyParallel: true,
  // Headless browsers draw the map in software, which is slow: few workers,
  // generous timeouts.
  workers: process.env.CI ? 2 : 3,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'e2e/report' }]]
    : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'iphone-16',
      use: { ...devices['iPhone 16 landscape'], ...fullScreen(852, 393) },
    },
    {
      name: 'iphone-se',
      use: {
        ...devices['iPhone SE (3rd gen) landscape'],
        ...fullScreen(667, 375),
      },
    },
    {
      name: 'pixel-7',
      use: { ...devices['Pixel 7 landscape'], ...fullScreen(915, 412) },
    },
  ],
});
