import { defaultContent } from '@voltiris/content';
import { cropPrice, STATE_VERSION, type GameState } from '@voltiris/sim';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { GameStoreContext } from './game/context';
import { ServicesContext, type AppServices } from './game/services';
import { createTestStore, firstGreenhouseOf } from './game/test-utils';
import type { BuildingId } from './iso/layout';
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
  const tapBuilding = (id: BuildingId) =>
    act(() => store.getState().openWindow(id));
  return { store, services, freshGame, runTicks, openPlot, tapBuilding };
}

function badge(name: string) {
  return screen.getByRole('group', { name });
}

function withWater(game: GameState, water: number): GameState {
  return {
    ...game,
    greenhouses: game.greenhouses.map((g) => ({
      ...g,
      climate: { ...g.climate, water },
    })),
  };
}

/** 8 strawberries of 90% quality, just harvested. */
function withHarvest(game: GameState): GameState {
  const lot = {
    id: 'lot-1',
    cropId: 'strawberry',
    units: 8,
    quality: 0.9,
    harvestedAtHour: game.clock.gameHour,
  } as const;
  return { ...game, storage: { lots: [lot] } };
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
    expect(within(badge('Humidity')).getByText('60%')).toBeDefined();
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
    ).toHaveLength(5);
    const tomato = within(bubble).getByRole('button', { name: 'Plant Tomato' });
    // Seed price, and about an hour to grow in the starting greenhouse.
    expect(tomato).toHaveTextContent('15');
    expect(tomato).toHaveTextContent('1 h');

    await user.click(tomato);

    expect(firstGreenhouseOf(store).plots[0]?.planting?.cropId).toBe('tomato');
    expect(screen.getByLabelText('485 Volticoins')).toBeDefined();
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
    await user.click(screen.getByRole('button', { name: 'Plant Pepper' }));

    runTicks(100);
    const meter = screen.getByRole('progressbar', { name: 'Growth' });
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(10);
  });

  it('offers water right where it says the plants are thirsty', async () => {
    const user = userEvent.setup();
    const { store, openPlot } = renderApp();
    act(() =>
      store.getState().replaceGame(withWater(store.getState().game, 40)),
    );
    openPlot(0);
    await user.click(screen.getByRole('button', { name: 'Plant Cucumber' }));

    const bubble = screen.getByRole('dialog', { name: 'Plot 1' });
    expect(within(bubble).getByText('Thirsty')).toBeDefined();
    await user.click(
      within(bubble).getByRole('button', { name: /^Water the plants/ }),
    );
    expect(firstGreenhouseOf(store).climate.water).toBe(50);
  });

  it('harvests a ready crop into storage', async () => {
    const user = userEvent.setup();
    const { store, openPlot, runTicks } = renderApp();
    openPlot(0);
    await user.click(screen.getByRole('button', { name: 'Plant Microgreens' }));
    runTicks(12);

    const bubble = screen.getByRole('dialog', { name: 'Plot 1' });
    expect(within(bubble).getByText('Ready!')).toBeDefined();
    await user.click(within(bubble).getByRole('button', { name: 'Harvest' }));

    expect(store.getState().game.storage.lots).toMatchObject([
      { cropId: 'microgreens', units: 6 },
    ]);
    expect(screen.getByRole('status')).toHaveTextContent(
      '6 × Microgreens went to storage',
    );
    // The plot is free again: straight back to the seeds.
    expect(within(bubble).getByText('Pick a seed')).toBeDefined();
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
  it('the town hall is under construction', () => {
    const { tapBuilding } = renderApp();
    tapBuilding('village');
    const window = screen.getByRole('dialog', { name: 'Village' });
    expect(within(window).getByText('Town hall')).toBeDefined();
    expect(within(window).getByText('Under construction')).toBeDefined();
    expect(screen.getByTestId('game-canvas')).toBeDefined();
  });

  it('the storage shows each harvest and how fresh it still is', async () => {
    const user = userEvent.setup();
    const { store, tapBuilding, runTicks } = renderApp();
    // The game is already running, so the ticks below are play, not a break.
    runTicks(0);
    act(() => store.getState().replaceGame(withHarvest(store.getState().game)));
    tapBuilding('storage');
    const window = screen.getByRole('dialog', { name: 'Storage' });
    expect(
      within(window).getByRole('meter', { name: 'Storage used' }),
    ).toHaveAttribute('aria-valuenow', '8');
    expect(within(window).getByText('8 × Strawberry')).toBeDefined();
    expect(within(window).getByText('Quality 90%')).toBeDefined();
    // Strawberries keep 3 game days: 18 real minutes.
    expect(within(window).getByText('Fresh for 18 min')).toBeDefined();

    runTicks(36);
    expect(within(window).getByText('Quality 45%')).toBeDefined();

    await user.click(
      within(window).getByRole('button', { name: 'Go to the market' }),
    );
    expect(screen.getByRole('dialog', { name: 'Market' })).toBeDefined();
  });

  it('the market sells what is in storage at the price shown', async () => {
    const user = userEvent.setup();
    const { store, tapBuilding } = renderApp();
    act(() => store.getState().replaceGame(withHarvest(store.getState().game)));
    tapBuilding('market');
    const window = screen.getByRole('dialog', { name: 'Market' });
    expect(
      within(window).getByRole('button', { name: 'Sell Tomato' }),
    ).toBeDisabled();

    const game = store.getState().game;
    const price = cropPrice(game.market, 'strawberry', 0, defaultContent);
    expect(within(window).getByLabelText('Strawberry price')).toHaveTextContent(
      price.toFixed(2),
    );
    const revenue = Math.round(8 * price * 0.9);
    const sellButton = within(window).getByRole('button', {
      name: 'Sell Strawberry',
    });
    expect(sellButton).toHaveTextContent(`+${revenue}`);

    await user.click(sellButton);
    expect(store.getState().game.money).toBe(game.money + revenue);
    expect(store.getState().game.storage.lots).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent(
      `Sold 8 × Strawberry for ${revenue}`,
    );
  });

  it('closes from the backdrop, but not from the click of the tap that opened it', async () => {
    const user = userEvent.setup();
    const { tapBuilding } = renderApp();
    // The tap on the map: pressed on the canvas, window opened, then the
    // click that follows the tap lands on the new backdrop.
    fireEvent.pointerDown(screen.getByTestId('game-canvas'));
    tapBuilding('storage');
    const backdrop = screen.getByRole('dialog').parentElement;
    if (!backdrop) throw new Error('expected a backdrop');
    fireEvent.click(backdrop);
    expect(screen.getByRole('dialog', { name: 'Storage' })).toBeDefined();

    await user.click(backdrop);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes a window from its close button or with Escape', async () => {
    const user = userEvent.setup();
    const { tapBuilding } = renderApp();
    tapBuilding('market');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    tapBuilding('village');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('greenhouse', () => {
  function openGreenhouse(store: ReturnType<typeof renderApp>['store']) {
    act(() => store.getState().openWindow('greenhouse'));
    return screen.getByRole('dialog', { name: 'Greenhouse' });
  }

  /** The game with more money, and the first greenhouse changed. */
  function withGreenhouse(
    game: GameState,
    change: Partial<GameState['greenhouses'][number]>,
    money = game.money,
  ): GameState {
    return {
      ...game,
      money,
      greenhouses: game.greenhouses.map((g) => ({ ...g, ...change })),
    };
  }

  it('buys a heater that warms the air', async () => {
    const user = userEvent.setup();
    const { store, runTicks } = renderApp();
    runTicks(0);
    const window = openGreenhouse(store);
    expect(
      within(window).getByRole('tab', { name: 'Equipment' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      within(window).getByText('Warms the air when it is too cold.'),
    ).toBeDefined();

    await user.click(
      within(window).getByRole('button', {
        name: 'Buy Heater: Gas heater (150 Volticoins)',
      }),
    );
    expect(screen.getByLabelText('350 Volticoins')).toBeDefined();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Gas heater installed',
    );
    expect(within(window).getByText('Gas heater · Level 1 of 3')).toBeDefined();
    // Heating the 20 °C greenhouse to its 23 °C target takes three quarters
    // of its output.
    expect(within(window).getByText(/Heating · 75%/)).toBeDefined();

    await user.click(within(window).getByRole('button', { name: 'Close' }));
    expect(within(badge('Temperature')).getByText('20.0 °C')).toBeDefined();
    runTicks(10);
    expect(within(badge('Temperature')).getByText('23.0 °C')).toBeDefined();
  });

  it('sets the targets the equipment works to', async () => {
    const user = userEvent.setup();
    const { store } = renderApp();
    const { id } = firstGreenhouseOf(store);
    act(() => {
      store.getState().buyEquipment(id, 'heater');
    });
    const window = openGreenhouse(store);
    await user.click(within(window).getByRole('tab', { name: 'Climate' }));

    const heatTo = within(window).getByRole('group', { name: 'Heat up to' });
    expect(within(heatTo).getByText('23.0 °C')).toBeDefined();
    expect(within(heatTo).getByText('Now 20.0 °C')).toBeDefined();
    await user.click(within(heatTo).getByRole('button', { name: 'Raise' }));
    expect(within(heatTo).getByText('24.0 °C')).toBeDefined();
    expect(firstGreenhouseOf(store).setpoints.heatTo).toBe(24);
    // Only the equipment that is installed has targets here.
    expect(
      within(window).queryByRole('group', { name: 'Keep CO₂ at' }),
    ).toBeNull();
  });

  it('lets the climate computer set the targets, or the player', async () => {
    const user = userEvent.setup();
    const { store } = renderApp();
    const game = store.getState().game;
    act(() =>
      store.getState().replaceGame(
        withGreenhouse(game, {
          equipment: { co2: { level: 1, wear: 0 } },
          computer: true,
          auto: true,
        }),
      ),
    );
    const window = openGreenhouse(store);
    await user.click(within(window).getByRole('tab', { name: 'Climate' }));

    const toggle = within(window).getByRole('switch', {
      name: 'Automatic control',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    const co2 = within(window).getByRole('group', { name: 'Keep CO₂ at' });
    // Nothing grows, so the computer lets the injector idle.
    expect(within(co2).getByText('400 ppm')).toBeDefined();
    expect(within(co2).getByRole('button', { name: 'Raise' })).toBeDisabled();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(within(co2).getByText('800 ppm')).toBeDefined();
    expect(within(co2).getByRole('button', { name: 'Raise' })).toBeEnabled();
  });

  it('upgrades the greenhouse itself', async () => {
    const user = userEvent.setup();
    const { store } = renderApp();
    act(() =>
      store
        .getState()
        .replaceGame(withGreenhouse(store.getState().game, {}, 2_000)),
    );
    const window = openGreenhouse(store);
    await user.click(within(window).getByRole('tab', { name: 'Upgrades' }));
    expect(
      within(window).getByText('Single glass: 80% light · keeps heat 1.0×'),
    ).toBeDefined();

    await user.click(
      within(window).getByRole('button', {
        name: 'Upgrade Size: Medium (600 Volticoins)',
      }),
    );
    expect(firstGreenhouseOf(store).plots).toHaveLength(6);
    expect(within(window).getByText('Medium: 6 plots')).toBeDefined();

    await user.click(
      within(window).getByRole('button', {
        name: 'Buy Climate computer (600 Volticoins)',
      }),
    );
    expect(firstGreenhouseOf(store)).toMatchObject({
      computer: true,
      auto: true,
    });
  });

  it('services worn equipment', async () => {
    const user = userEvent.setup();
    const { store } = renderApp();
    act(() =>
      store.getState().replaceGame(
        withGreenhouse(store.getState().game, {
          equipment: { heater: { level: 1, wear: 0.5 } },
        }),
      ),
    );
    const window = openGreenhouse(store);
    expect(within(window).getByText(/Wear 50%/)).toBeDefined();
    // A quarter of the price, for half the wear: 18.75, rounded up.
    await user.click(
      within(window).getByRole('button', {
        name: 'Service Heater (19 Volticoins)',
      }),
    );
    expect(firstGreenhouseOf(store).equipment.heater).toEqual({
      level: 1,
      wear: 0,
    });
    expect(screen.getByLabelText('481 Volticoins')).toBeDefined();
  });

  it('keeps quiet about a little wear', () => {
    const { store } = renderApp();
    act(() =>
      store.getState().replaceGame(
        withGreenhouse(store.getState().game, {
          equipment: { heater: { level: 1, wear: 0.004 } },
        }),
      ),
    );
    const window = openGreenhouse(store);
    expect(within(window).queryByText(/Wear/)).toBeNull();
    expect(
      within(window).queryByRole('button', { name: /^Service/ }),
    ).toBeNull();
  });

  it('says when the equipment is off for want of money', () => {
    const { store } = renderApp();
    act(() =>
      store
        .getState()
        .replaceGame(
          withGreenhouse(
            store.getState().game,
            { equipment: { heater: { level: 1, wear: 0 } } },
            0,
          ),
        ),
    );
    const window = openGreenhouse(store);
    expect(within(window).getByRole('alert')).toHaveTextContent(
      'Not enough Volticoins: the equipment is off.',
    );
  });
});

describe('energy', () => {
  function flow(window: HTMLElement, name: string) {
    return within(window).getByRole('group', { name });
  }

  it('shows where the power comes from this hour, and its price', () => {
    const { tapBuilding } = renderApp();
    tapBuilding('energy');
    const window = screen.getByRole('dialog', { name: 'Energy' });
    // The game starts at midnight: the night tariff, nothing to power.
    expect(window).toHaveTextContent('Night');
    expect(window).toHaveTextContent('Day from 07:00');
    expect(flow(window, 'Solar panels')).toHaveTextContent('None built yet');
    expect(flow(window, 'Grid')).toHaveTextContent('Nothing bought or sold');
  });

  it('builds solar panels that make power by day, and sells the spare', async () => {
    const user = userEvent.setup();
    const { store, tapBuilding, runTicks } = renderApp();
    runTicks(0);
    tapBuilding('energy');
    const window = screen.getByRole('dialog', { name: 'Energy' });
    await user.click(within(window).getByRole('tab', { name: 'Build' }));
    await user.click(
      within(window).getByRole('button', {
        name: 'Build Solar panels: Rooftop panels (300 Volticoins)',
      }),
    );
    expect(store.getState().game.energy.solar).toBe(1);
    expect(screen.getByLabelText('200 Volticoins')).toBeDefined();
    expect(
      within(window).getByText('Rooftop panels: 3 kW at midday'),
    ).toBeDefined();

    await user.click(within(window).getByRole('tab', { name: 'Now' }));
    expect(flow(window, 'Solar panels')).toHaveTextContent('No sun now');
    runTicks(12);
    expect(flow(window, 'Solar panels')).toHaveTextContent('3.0 kW');
    expect(flow(window, 'Grid')).toHaveTextContent('Selling spare power');
    expect(window).toHaveTextContent('This hour’s energy earns');
  });

  it('fills a battery from cheap night power', () => {
    const { store, tapBuilding, runTicks } = renderApp();
    runTicks(0);
    act(() => {
      store.getState().buyEnergy('battery');
    });
    tapBuilding('energy');
    const window = screen.getByRole('dialog', { name: 'Energy' });
    expect(flow(window, 'Battery')).toHaveTextContent('Charging');
    runTicks(3);
    const meter = within(window).getByRole('meter', { name: 'Battery charge' });
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(5);
  });

  it('adds up the day’s costs, and keeps yesterday’s', async () => {
    const user = userEvent.setup();
    const { store, tapBuilding, runTicks } = renderApp();
    runTicks(0);
    act(() => {
      store.getState().buyEquipment(firstGreenhouseOf(store).id, 'lights');
    });
    tapBuilding('energy');
    const window = screen.getByRole('dialog', { name: 'Energy' });
    await user.click(within(window).getByRole('tab', { name: 'Costs' }));
    const grid = () =>
      within(window).getByRole('row', { name: /^Power from the grid/ });
    expect(grid()).toHaveTextContent('–');

    runTicks(24);
    const yesterday = store.getState().game.energy.yesterday;
    expect(yesterday?.power).toBeGreaterThan(0);
    expect(grid()).not.toHaveTextContent('–');
    expect(within(window).getByRole('row', { name: /^Total/ })).toBeDefined();
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
    act(() => {
      store
        .getState()
        .plantCrop(greenhouse.id, greenhouse.plots[1]?.id ?? '', 'cucumber');
    });
    // The player leaves the app for a while.
    act(() => store.getState().markAway());
    runTicks(24 * 30);
    const window = screen.getByRole('dialog', { name: 'Welcome back!' });
    expect(within(window).getByText('Ready to harvest')).toBeDefined();
    expect(within(window).getByText('Cucumber')).toBeDefined();
    expect(within(window).getByText('Plot 2')).toBeDefined();
  });

  it('lists the produce that spoiled in storage', () => {
    const { store, runTicks } = renderApp();
    act(() => store.getState().replaceGame(withHarvest(store.getState().game)));
    act(() => store.getState().markAway());
    runTicks(100);
    const window = screen.getByRole('dialog', { name: 'Welcome back!' });
    expect(within(window).getByText('Spoiled in storage')).toBeDefined();
    expect(within(window).getByText('8 × Strawberry')).toBeDefined();
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
      fromVersion: STATE_VERSION,
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
