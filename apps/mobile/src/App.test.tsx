import { defaultContent } from '@voltiris/content';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { GameStoreContext } from './game/context';
import { createTestStore, firstGreenhouseOf } from './game/test-utils';

// jsdom has no WebGL; the Pixi scene is checked on a device instead.
vi.mock('./scene/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas" />,
}));

const MS_PER_TICK = defaultContent.time.realMsPerTick;

afterEach(cleanup);

function renderApp() {
  const { clock, store } = createTestStore();
  render(
    <GameStoreContext value={store}>
      <App />
    </GameStoreContext>,
  );
  const runTicks = (count: number) =>
    act(() => {
      clock.advance(count * MS_PER_TICK);
      store.getState().advance();
    });
  const openPlot = (index: number) =>
    act(() => {
      const plot = firstGreenhouseOf(store).plots[index];
      store.getState().selectPlot(plot?.id ?? null);
    });
  return { store, runTicks, openPlot };
}

function gauge(name: string) {
  return screen.getByRole('group', { name });
}

describe('HUD', () => {
  it('shows money, day, time and season', () => {
    renderApp();
    expect(screen.getByLabelText('500 Volticoins')).toHaveTextContent('500');
    expect(screen.getByText('Day 1 · 00:00')).toBeDefined();
    expect(screen.getByText('Spring · Year 1')).toBeDefined();
  });

  it('shows the six climate gauges', () => {
    renderApp();
    expect(within(gauge('Temperature')).getByText('20.0 °C')).toBeDefined();
    expect(within(gauge('Humidity')).getByText('70%')).toBeDefined();
    expect(within(gauge('CO₂')).getByText('420 ppm')).toBeDefined();
    expect(within(gauge('Light')).getByText('400 PAR')).toBeDefined();
    expect(within(gauge('Water')).getByText('65%')).toBeDefined();
    expect(within(gauge('Nutrients')).getByText('2.5 EC')).toBeDefined();
    const gauges = screen.getAllByRole('group');
    expect(gauges).toHaveLength(6);
    for (const g of gauges) expect(g).toHaveAttribute('data-status', 'idle');
    expect(screen.queryByText('No crops')).toBeNull();
  });

  it('updates live as the simulation ticks', () => {
    const { runTicks } = renderApp();
    runTicks(14);
    expect(screen.getByText('Day 1 · 14:00')).toBeDefined();
    runTicks(24 * 15);
    expect(screen.getByText('Day 16 · 14:00')).toBeDefined();
    expect(screen.getByText('Summer · Year 1')).toBeDefined();
  });
});

describe('plant panel', () => {
  it('opens for a tapped plot and plants a crop', async () => {
    const user = userEvent.setup();
    const { store, openPlot } = renderApp();

    openPlot(0);
    const panel = screen.getByRole('complementary', { name: 'Plot 1' });
    expect(within(panel).getByText('Choose a crop to plant')).toBeDefined();
    expect(
      within(panel).getAllByRole('button', { name: /^Plant / }),
    ).toHaveLength(3);

    await user.click(
      within(panel).getByRole('button', { name: 'Plant Tomato' }),
    );

    expect(firstGreenhouseOf(store).plots[0]?.planting?.cropId).toBe('tomato');
    expect(within(panel).getByText('Growing')).toBeDefined();
    expect(
      within(panel).getByRole('progressbar', { name: 'Growth' }),
    ).toHaveAttribute('aria-valuenow', '0');
  });

  it('explains what holds a crop back, and the gauges follow the crop', async () => {
    const user = userEvent.setup();
    const { openPlot } = renderApp();
    openPlot(0);
    await user.click(screen.getByRole('button', { name: 'Plant Tomato' }));

    // Starting climate: ambient CO₂ and 400 PAR are below a tomato's optimum.
    const panel = screen.getByRole('complementary', { name: 'Plot 1' });
    expect(within(panel).getByText('Holding it back')).toBeDefined();
    expect(within(gauge('CO₂')).getByText('Low')).toBeDefined();
    expect(within(gauge('Light')).getByText('Too dark')).toBeDefined();
    expect(within(gauge('Temperature')).getByText('Good')).toBeDefined();
    expect(gauge('CO₂')).toHaveAttribute('data-status', 'warn');
  });

  it('shows growth progress live', async () => {
    const user = userEvent.setup();
    const { openPlot, runTicks } = renderApp();
    openPlot(0);
    await user.click(screen.getByRole('button', { name: 'Plant Cucumber' }));

    runTicks(24 * 5);
    const meter = screen.getByRole('progressbar', { name: 'Growth' });
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(10);
  });

  it('closes with the close button', async () => {
    const user = userEvent.setup();
    const { openPlot } = renderApp();
    openPlot(1);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});

describe('bottom navigation', () => {
  it('switches to placeholder screens and back', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /Market/ }));
    expect(screen.getByRole('region', { name: 'Market' })).toHaveTextContent(
      'Coming soon',
    );
    expect(
      screen.queryByRole('region', { name: 'Greenhouse climate' }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: /Market/ })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(screen.getByRole('button', { name: /Greenhouse/ }));
    expect(
      screen.getByRole('region', { name: 'Greenhouse climate' }),
    ).toBeDefined();
  });

  it('keeps the game canvas mounted on every tab', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /Energy/ }));
    expect(screen.getByTestId('game-canvas')).toBeDefined();
  });
});
