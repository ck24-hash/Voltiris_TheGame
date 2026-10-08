import { defaultContent } from '@voltiris/content';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { GameStoreContext } from './game/context';
import { ServicesContext, type AppServices } from './game/services';
import { createTestStore, firstGreenhouseOf } from './game/test-utils';
import { readSaveText } from './save/saveFile';

// jsdom has no WebGL; the Pixi scene is checked on a device instead.
vi.mock('./scene/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas" />,
}));

const MS_PER_TICK = defaultContent.time.realMsPerTick;
const ANCHOR = { x: 400, top: 300, bottom: 340 };

afterEach(cleanup);

function renderApp() {
  const { clock, store } = createTestStore();
  const freshGame = createTestStore(77).store.getState().game;
  const services = {
    newGame: vi.fn(() => freshGame),
    now: () => 1_000,
    exportText: vi.fn<AppServices['exportText']>(() =>
      Promise.resolve('downloaded'),
    ),
  };
  render(
    <ServicesContext value={services}>
      <GameStoreContext value={store}>
        <App />
      </GameStoreContext>
    </ServicesContext>,
  );
  const runTicks = (count: number) =>
    act(() => {
      clock.advance(count * MS_PER_TICK);
      store.getState().advance();
    });
  const openPlot = (index: number) =>
    act(() => {
      const plot = firstGreenhouseOf(store).plots[index];
      store
        .getState()
        .selectPlot(plot ? { plotId: plot.id, anchor: ANCHOR } : null);
    });
  const tapBuilding = (id: 'market' | 'energy' | 'village') =>
    act(() => store.getState().openWindow(id));
  return { store, services, freshGame, runTicks, openPlot, tapBuilding };
}

function badge(name: string) {
  return screen.getByRole('group', { name });
}

describe('HUD', () => {
  it('shows money, day, time and season', () => {
    renderApp();
    expect(screen.getByLabelText('500 Volticoins')).toHaveTextContent('500');
    expect(screen.getByText('Day 1 · 00:00')).toBeDefined();
    expect(screen.getByText('Spring · Year 1')).toBeDefined();
  });

  it('shows the six climate readings, idle while nothing grows', () => {
    renderApp();
    expect(within(badge('Temperature')).getByText('20.0 °C')).toBeDefined();
    expect(within(badge('Humidity')).getByText('70%')).toBeDefined();
    expect(within(badge('CO₂')).getByText('420 ppm')).toBeDefined();
    expect(within(badge('Light')).getByText('400 PAR')).toBeDefined();
    expect(within(badge('Water')).getByText('65%')).toBeDefined();
    expect(within(badge('Nutrients')).getByText('2.5 EC')).toBeDefined();
    const badges = screen.getAllByRole('group');
    expect(badges).toHaveLength(6);
    for (const b of badges) expect(b).toHaveAttribute('data-status', 'idle');
  });

  it('updates live as the simulation ticks', () => {
    const { runTicks } = renderApp();
    runTicks(14);
    expect(screen.getByText('Day 1 · 14:00')).toBeDefined();
    runTicks(24 * 15);
    expect(screen.getByText('Day 16 · 14:00')).toBeDefined();
    expect(screen.getByText('Summer · Year 1')).toBeDefined();
  });

  it('opens the settings from the gear', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeDefined();
  });
});

describe('plot bubble', () => {
  it('opens at a tapped plot and plants a seed', async () => {
    const user = userEvent.setup();
    const { store, openPlot } = renderApp();

    openPlot(0);
    const bubble = screen.getByRole('dialog', { name: 'Plot 1' });
    expect(within(bubble).getByText('Pick a seed')).toBeDefined();
    expect(
      within(bubble).getAllByRole('button', { name: /^Plant / }),
    ).toHaveLength(3);

    await user.click(
      within(bubble).getByRole('button', { name: 'Plant Tomato' }),
    );

    expect(firstGreenhouseOf(store).plots[0]?.planting?.cropId).toBe('tomato');
    expect(within(bubble).getByText('Growing')).toBeDefined();
    expect(
      within(bubble).getByRole('progressbar', { name: 'Growth' }),
    ).toHaveAttribute('aria-valuenow', '0');
  });

  it('explains what holds a crop back, and the climate badges follow the crop', async () => {
    const user = userEvent.setup();
    const { openPlot } = renderApp();
    openPlot(0);
    await user.click(screen.getByRole('button', { name: 'Plant Tomato' }));

    // Starting climate: ambient CO₂ and 400 PAR are below a tomato's optimum.
    const bubble = screen.getByRole('dialog', { name: 'Plot 1' });
    expect(within(bubble).getByText('Holding it back')).toBeDefined();
    expect(within(badge('CO₂')).getByText('Low')).toBeDefined();
    expect(within(badge('Light')).getByText('Too dark')).toBeDefined();
    expect(badge('CO₂')).toHaveAttribute('data-status', 'warn');
    expect(badge('Temperature')).toHaveAttribute('data-status', 'good');
    expect(within(badge('Temperature')).queryByText('Good')).toBeNull();
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

  it('closes when the player taps elsewhere', () => {
    const { store, openPlot } = renderApp();
    openPlot(1);
    expect(screen.getByRole('dialog', { name: 'Plot 2' })).toBeDefined();
    act(() => store.getState().selectPlot(null));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('buildings', () => {
  it.each([
    ['market', 'Market', 'Market stall'],
    ['energy', 'Energy', 'Energy shed'],
    ['village', 'Village', 'Town hall'],
  ] as const)('the %s building opens the %s window', (id, title, building) => {
    const { tapBuilding } = renderApp();
    tapBuilding(id);
    const window = screen.getByRole('dialog', { name: title });
    expect(within(window).getByText(building)).toBeDefined();
    expect(within(window).getByText('Under construction')).toBeDefined();
    expect(screen.getByTestId('game-canvas')).toBeDefined();
  });

  it('closes a window from its close button or with Escape', async () => {
    const user = userEvent.setup();
    const { tapBuilding } = renderApp();
    tapBuilding('market');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    tapBuilding('energy');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('welcome back', () => {
  it('sums up a long break until the player carries on', async () => {
    const user = userEvent.setup();
    const { runTicks } = renderApp();
    runTicks(480);
    const window = screen.getByRole('dialog', { name: 'Welcome back!' });
    expect(window).toHaveTextContent('You were away for 2 h');
    expect(window).toHaveTextContent('20 d of game time');
    expect(window).toHaveTextContent('All quiet');

    await user.click(within(window).getByRole('button', { name: 'Let’s go!' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists the crops that became ready', () => {
    const { store, runTicks } = renderApp();
    const greenhouse = firstGreenhouseOf(store);
    act(() =>
      store
        .getState()
        .plantCrop(greenhouse.id, greenhouse.plots[1]?.id ?? '', 'cucumber'),
    );
    // The player leaves the app for a while.
    act(() => store.getState().markAway());
    runTicks(24 * 30);
    const window = screen.getByRole('dialog', { name: 'Welcome back!' });
    expect(within(window).getByText('Ready to harvest')).toBeDefined();
    expect(within(window).getByText('Cucumber')).toBeDefined();
    expect(within(window).getByText('Plot 2')).toBeDefined();
  });
});

describe('save tools', () => {
  async function openSettings() {
    const user = userEvent.setup();
    const app = renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    return { user, ...app };
  }

  it('exports the game as a save the game can read back', async () => {
    const { user, services, store } = await openSettings();
    await user.click(screen.getByRole('button', { name: /Export save/ }));

    expect(services.exportText).toHaveBeenCalledOnce();
    const [text, fileName] = services.exportText.mock.calls[0] ?? [];
    expect(fileName).toBe('voltiris-save-1970-01-01.json');
    expect(readSaveText(text ?? '', defaultContent)).toEqual({
      ok: true,
      state: store.getState().game,
      fromVersion: 1,
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Save file downloaded',
    );
  });

  it('imports a save after checking it', async () => {
    const { user, store, freshGame } = await openSettings();
    const text = JSON.stringify({
      format: 'voltiris-save',
      savedAt: 0,
      game: freshGame,
    });
    await user.click(screen.getByRole('button', { name: /Import save/ }));
    await user.click(screen.getByRole('textbox', { name: 'Save to import' }));
    await user.paste(text);
    await user.click(screen.getByRole('button', { name: 'Check save' }));
    await user.click(screen.getByRole('button', { name: 'Replace my game' }));

    expect(store.getState().game).toEqual(freshGame);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Save imported');
  });

  it('refuses something that is not a save', async () => {
    const { user, store } = await openSettings();
    const before = store.getState().game;
    await user.click(screen.getByRole('button', { name: /Import save/ }));
    await user.click(screen.getByRole('textbox', { name: 'Save to import' }));
    await user.paste('{"hello": 1}');
    await user.click(screen.getByRole('button', { name: 'Check save' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This is not a Voltiris save.',
    );
    expect(
      screen.queryByRole('button', { name: 'Replace my game' }),
    ).toBeNull();
    expect(store.getState().game).toBe(before);
  });

  it('starts a new game only after a confirmation', async () => {
    const { user, store, freshGame, services } = await openSettings();
    await user.click(screen.getByRole('button', { name: /New game/ }));
    expect(services.newGame).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    expect(store.getState().game).toBe(freshGame);
    expect(screen.getByRole('status')).toHaveTextContent('New game started');
  });
});
