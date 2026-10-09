import type {
  CropId,
  EnergyAsset,
  EquipmentKind,
  GameContent,
  SetpointId,
} from '@voltiris/content';
import {
  applyCommand,
  catchUp,
  type CatchUpReport,
  type Clock,
  type Command,
  type CommandError,
  type CommandMeta,
  type GameState,
  type GreenhouseUpgrade,
} from '@voltiris/sim';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { BuildingId } from '../iso/layout';
import { pageLifecycle } from './lifecycle';

/** Windows opened from the greenhouse and the buildings on the map, plus settings. */
type GameWindow = BuildingId | 'greenhouse' | 'settings';

/** Where the plot bubble points, in screen pixels of the game view. */
export interface BubbleAnchor {
  readonly x: number;
  /** Top of the plot or its plant: the bubble sits above it… */
  readonly top: number;
  /** …or below the plot when there is no room above. */
  readonly bottom: number;
}

interface PlotSelection {
  readonly plotId: string;
  readonly anchor: BubbleAnchor;
}

interface Notice {
  readonly id: number;
  readonly text: string;
  readonly tone: 'info' | 'error';
}

/** Breaks of at least this many ticks (5 real minutes) get a summary. */
const AWAY_SUMMARY_MIN_TICKS = 20;

export interface GameStore {
  readonly content: GameContent;
  readonly game: GameState;
  readonly selection: PlotSelection | null;
  readonly window: GameWindow | null;
  /** What happened during a long break, shown until dismissed. */
  readonly away: CatchUpReport | null;
  /**
   * The player was away (the game just launched, or the app was in the
   * background): the next catch-up gets a summary if it is long. Stalls
   * while playing never do.
   */
  readonly awayPending: boolean;
  readonly notice: Notice | null;
  /** Goes up whenever the game must be saved right away. */
  readonly checkpoint: number;
  // Actions are arrow-typed properties: components pull them off the store.
  /** Runs every tick that is due by now. */
  readonly advance: () => void;
  // Player commands return why the sim refused them, or null if it accepted.
  readonly plantCrop: (
    greenhouseId: string,
    plotId: string,
    cropId: CropId,
  ) => CommandError | null;
  readonly water: (greenhouseId: string) => CommandError | null;
  readonly fertilize: (greenhouseId: string) => CommandError | null;
  readonly harvestCrop: (
    greenhouseId: string,
    plotId: string,
  ) => CommandError | null;
  readonly sellCrop: (cropId: CropId, units: number) => CommandError | null;
  /** Installs a device, or upgrades it to its next level. */
  readonly buyEquipment: (
    greenhouseId: string,
    kind: EquipmentKind,
  ) => CommandError | null;
  readonly serviceEquipment: (
    greenhouseId: string,
    kind: EquipmentKind,
  ) => CommandError | null;
  readonly setSetpoint: (
    greenhouseId: string,
    setpoint: SetpointId,
    value: number,
  ) => CommandError | null;
  readonly setAutoControl: (
    greenhouseId: string,
    auto: boolean,
  ) => CommandError | null;
  readonly upgradeGreenhouse: (
    greenhouseId: string,
    upgrade: GreenhouseUpgrade,
  ) => CommandError | null;
  /** Builds an energy asset, or upgrades it to its next level. */
  readonly buyEnergy: (asset: EnergyAsset) => CommandError | null;
  readonly selectPlot: (selection: PlotSelection | null) => void;
  readonly openWindow: (window: GameWindow) => void;
  readonly closeWindow: () => void;
  readonly dismissAway: () => void;
  /** The app went to the background. */
  readonly markAway: () => void;
  readonly notify: (text: string, tone?: Notice['tone']) => void;
  readonly dismissNotice: (id: number) => void;
  /** Swaps in another game (an import or a new game) and saves it. */
  readonly replaceGame: (game: GameState) => void;
}

export interface GameStoreDeps {
  readonly content: GameContent;
  readonly clock: Clock;
  readonly newId: () => string;
  readonly game: GameState;
}

/** UI state around the sim. The UI only reads state and sends commands. */
export function createGameStore(deps: GameStoreDeps): StoreApi<GameStore> {
  const { content, clock, newId } = deps;

  return createStore<GameStore>()((set, get) => {
    /** Runs the ticks due by `now`, keeping a summary of long breaks. */
    const catchUpTo = (now: number): GameState => {
      const { game, away, awayPending } = get();
      const { state, report } = catchUp(game, { now: () => now }, content);
      // The first catch-up after launch or a return covers the whole break;
      // later ones (even late or long) are just play.
      if (state !== game || awayPending) {
        const summary =
          awayPending && report.ticks >= AWAY_SUMMARY_MIN_TICKS
            ? mergeReports(away, report)
            : away;
        set({ game: state, away: summary, awayPending: false });
      }
      return state;
    };

    const run = (
      build: (meta: CommandMeta) => Command,
    ): CommandError | null => {
      // Read the clock once: catch up to that instant, so the command lands
      // at the game hour its timestamp belongs to (a replay must agree).
      const now = clock.now();
      const game = catchUpTo(now);
      const result = applyCommand(
        game,
        build({ id: newId(), issuedAt: now }),
        content,
      );
      if (!result.ok) return result.error;
      set({ game: result.state, checkpoint: get().checkpoint + 1 });
      return null;
    };

    let noticeId = 0;

    return {
      content,
      game: deps.game,
      selection: null,
      window: null,
      away: null,
      awayPending: true,
      notice: null,
      checkpoint: 0,

      advance: () => {
        catchUpTo(clock.now());
      },

      plantCrop: (greenhouseId, plotId, cropId) =>
        run((meta) => ({
          ...meta,
          type: 'PlantCrop',
          greenhouseId,
          plotId,
          cropId,
        })),

      water: (greenhouseId) =>
        run((meta) => ({ ...meta, type: 'Water', greenhouseId })),

      fertilize: (greenhouseId) =>
        run((meta) => ({ ...meta, type: 'Fertilize', greenhouseId })),

      harvestCrop: (greenhouseId, plotId) =>
        run((meta) => ({ ...meta, type: 'HarvestCrop', greenhouseId, plotId })),

      sellCrop: (cropId, units) =>
        run((meta) => ({ ...meta, type: 'SellCrop', cropId, units })),

      buyEquipment: (greenhouseId, kind) =>
        run((meta) => ({ ...meta, type: 'BuyEquipment', greenhouseId, kind })),

      serviceEquipment: (greenhouseId, kind) =>
        run((meta) => ({
          ...meta,
          type: 'ServiceEquipment',
          greenhouseId,
          kind,
        })),

      setSetpoint: (greenhouseId, setpoint, value) =>
        run((meta) => ({
          ...meta,
          type: 'SetSetpoint',
          greenhouseId,
          setpoint,
          value,
        })),

      setAutoControl: (greenhouseId, auto) =>
        run((meta) => ({
          ...meta,
          type: 'SetAutoControl',
          greenhouseId,
          auto,
        })),

      upgradeGreenhouse: (greenhouseId, upgrade) =>
        run((meta) => ({
          ...meta,
          type: 'UpgradeGreenhouse',
          greenhouseId,
          upgrade,
        })),

      buyEnergy: (asset) =>
        run((meta) => ({ ...meta, type: 'BuyEnergy', asset })),

      selectPlot: (selection) => {
        set({ selection });
      },

      openWindow: (window) => {
        set({ window, selection: null });
      },

      closeWindow: () => {
        set({ window: null });
      },

      dismissAway: () => {
        set({ away: null });
      },

      markAway: () => {
        set({ awayPending: true });
      },

      notify: (text, tone = 'info') => {
        set({ notice: { id: ++noticeId, text, tone } });
      },

      dismissNotice: (id) => {
        if (get().notice?.id === id) set({ notice: null });
      },

      replaceGame: (game) => {
        set({
          game,
          selection: null,
          window: null,
          away: null,
          checkpoint: get().checkpoint + 1,
        });
      },
    };
  });
}

/** Adds up two catch-ups, when a second break comes before the first summary closes. */
function mergeReports(
  earlier: CatchUpReport | null,
  later: CatchUpReport,
): CatchUpReport {
  if (!earlier) return later;
  return {
    awayMs: earlier.awayMs + later.awayMs,
    ticks: earlier.ticks + later.ticks,
    skippedMs: earlier.skippedMs + later.skippedMs,
    cropsReady: [...earlier.cropsReady, ...later.cropsReady],
    spoiled: [...earlier.spoiled, ...later.spoiled],
    moneyChange: earlier.moneyChange + later.moneyChange,
  };
}

/**
 * Advances the game on a timer while the app is visible. In the background
 * the loop stops, and the whole break is caught up (with its summary) as
 * soon as the app comes back. Returns a function that stops the loop.
 */
export function startGameLoop(
  store: StoreApi<GameStore>,
  { intervalMs = 500, lifecycle = pageLifecycle } = {},
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  const pause = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  const resume = () => {
    store.getState().advance();
    timer ??= setInterval(() => store.getState().advance(), intervalMs);
  };

  resume();
  const stopHide = lifecycle.onHide(() => {
    pause();
    store.getState().markAway();
  });
  const stopShow = lifecycle.onShow(resume);
  return () => {
    pause();
    stopHide();
    stopShow();
  };
}
