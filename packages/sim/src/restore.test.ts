import { defaultContent, type GameContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import saveV1 from './fixtures/save-v1.json';
import saveV2 from './fixtures/save-v2.json';
import { initialMarket } from './market';
import {
  migrateState,
  MIGRATIONS,
  restoreGame,
  type Migration,
} from './restore';
import { STATE_VERSION, type GameState } from './state';
import {
  buy,
  deepFreeze,
  harvest,
  newTestGame,
  optimalClimate,
  plant,
  runTicks,
  STILL_AIR,
  withClimate,
} from './test-utils';

/** What a save looks like after a trip through JSON (IndexedDB or a file). */
function jsonCopy(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Plot 0: a ready cucumber. Plot 2: a growing tomato. One harvest stored.
 * A heater that has run a while.
 */
function playedGame(): GameState {
  const game = buy(
    withClimate(newTestGame(), optimalClimate('cucumber')),
    'heater',
  );
  const run = (state: GameState) => runTicks(state, 30, STILL_AIR);
  const first = run(plant(plant(game, 'cucumber', 0), 'tomato', 2));
  return run(plant(harvest(first, 0), 'cucumber', 0));
}

/** What a greenhouse from before Phase 6 gets. */
const PHASE_5_GREENHOUSE = {
  glass: 1,
  size: 1,
  equipment: {},
  setpoints: defaultContent.control.initial,
  computer: false,
  auto: false,
};

type Path = readonly (string | number)[];
const REMOVE = Symbol('remove');

/** A JSON copy of a played game with the field at `path` set (or removed). */
function editedSave(path: Path, value: unknown): unknown {
  const save = jsonCopy(playedGame());
  let target = save as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) {
    target = target[key] as Record<string | number, unknown>;
  }
  const last = path[path.length - 1] ?? '';
  if (value === REMOVE) delete target[last];
  else target[last] = value;
  return save;
}

/** "greenhouses[0].plots[1]" for ['greenhouses', 0, 'plots', 1]. */
function pathName(path: Path): string {
  return path
    .map((key, k) =>
      typeof key === 'number' ? `[${key}]` : k === 0 ? key : `.${key}`,
    )
    .join('');
}

describe('restoreGame', () => {
  it('restores a saved game exactly', () => {
    const game = playedGame();
    expect(restoreGame(jsonCopy(game), defaultContent)).toEqual({
      ok: true,
      state: game,
      fromVersion: STATE_VERSION,
    });
  });

  it('still loads a version 1 save, with an empty storage and a calm market', () => {
    const result = restoreGame(saveV1, defaultContent);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.fromVersion).toBe(1);
    expect(result.state.version).toBe(STATE_VERSION);
    expect(result.state.clock.gameHour).toBe(500);
    const plots = result.state.greenhouses[0]?.plots ?? [];
    expect(plots.map((p) => p.planting?.status ?? 'empty')).toEqual([
      'ready',
      'growing',
      'empty',
      'empty',
    ]);
    expect(result.state.storage).toEqual({ lots: [] });
    expect(result.state.market).toEqual(initialMarket());
    expect(result.state.owed).toBe(0);
    expect(result.state.greenhouses[0]).toMatchObject(PHASE_5_GREENHOUSE);
  });

  it('still loads a version 2 save, with a bare greenhouse and nothing owed', () => {
    const result = restoreGame(saveV2, defaultContent);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.fromVersion).toBe(2);
    expect(result.state.version).toBe(STATE_VERSION);
    expect(result.state.money).toBe(742);
    expect(result.state.owed).toBe(0);
    const [greenhouse] = result.state.greenhouses;
    expect(greenhouse).toMatchObject(PHASE_5_GREENHOUSE);
    expect(greenhouse?.climate.water).toBe(48.5);
    expect(greenhouse?.plots.map((p) => p.planting?.cropId ?? null)).toEqual([
      'strawberry',
      'microgreens',
      null,
      null,
    ]);
    expect(result.state.storage.lots).toHaveLength(1);
    expect(result.state.market.swings.strawberry).toBe(1.12);
  });

  it('drops unknown extra fields', () => {
    const withExtras = editedSave(['greenhouses', 0, 'plots', 0, 'extra'], 1);
    (withExtras as Record<string, unknown>).cheat = true;
    const greenhouse = (
      withExtras as { greenhouses: { equipment: Record<string, unknown> }[] }
    ).greenhouses[0];
    if (greenhouse) greenhouse.equipment.laser = { level: 1, wear: 0 };
    expect(restoreGame(withExtras, defaultContent)).toMatchObject({
      ok: true,
      state: playedGame(),
    });
  });

  it.each([
    ['NOT_A_SAVE', 'text', 'hello'],
    ['NOT_A_SAVE', 'a list', []],
    ['NOT_A_SAVE', 'no version', editedSave(['version'], REMOVE)],
    ['INVALID', 'version 0', editedSave(['version'], 0)],
    ['TOO_NEW', 'a newer version', editedSave(['version'], 999)],
  ] as const)('rejects %s: %s', (code, _what, save) => {
    expect(restoreGame(save, defaultContent)).toMatchObject({
      ok: false,
      error: { code },
    });
  });

  it.each<[Path, unknown, string]>([
    [['money'], 'lots', 'a number'],
    [['clock', 'gameHour'], -1, 'a number from 0 up'],
    [['clock', 'gameHour'], 1.5, 'a whole number'],
    [['rng', 'state'], 2 ** 32, 'an unsigned 32-bit integer'],
    [['playerId'], '', 'a non-empty string'],
    [['greenhouses'], {}, 'a list'],
    [['greenhouses', 0, 'climate', 'co2'], REMOVE, 'a number'],
    [['greenhouses', 0, 'climate', 'light'], null, 'a number'],
    [['greenhouses', 0, 'plots', 1], 3, 'an object'],
    [['greenhouses', 0, 'plots', 1, 'planting'], REMOVE, 'an object'],
    [
      ['greenhouses', 0, 'plots', 0, 'planting', 'cropId'],
      'banana',
      'a known crop',
    ],
    [
      ['greenhouses', 0, 'plots', 0, 'planting', 'status'],
      'rotten',
      '"growing" or "ready"',
    ],
    [['greenhouses', 0, 'plots', 0, 'planting', 'quality'], 1.5, 'at most 1'],
    [
      ['greenhouses', 0, 'plots', 2, 'planting', 'stress'],
      -1,
      'a number from 0 up',
    ],
    [['storage'], REMOVE, 'an object'],
    [['storage', 'lots'], null, 'a list'],
    [['storage', 'lots', 0, 'units'], 0, 'a number from 1 up'],
    [['storage', 'lots', 0, 'units'], 2.5, 'a whole number'],
    [['storage', 'lots', 0, 'quality'], 1.2, 'at most 1'],
    [['storage', 'lots', 0, 'cropId'], 'banana', 'a known crop'],
    [['storage', 'lots', 0, 'harvestedAtHour'], REMOVE, 'a number from 0 up'],
    [['market', 'swings'], [], 'an object'],
    [['market', 'swings', 'strawberry'], REMOVE, 'a number'],
    [['market', 'swings', 'tomato'], 0, 'a number above 0'],
    [['owed'], REMOVE, 'a number from 0 up'],
    [['owed'], 1, 'below 1'],
    [['greenhouses', 0, 'glass'], 0, 'a number from 1 up'],
    [['greenhouses', 0, 'glass'], 4, 'at most 3'],
    [['greenhouses', 0, 'size'], 1.5, 'a whole number'],
    [['greenhouses', 0, 'equipment'], null, 'an object'],
    [['greenhouses', 0, 'equipment', 'heater', 'level'], 4, 'at most 3'],
    [['greenhouses', 0, 'equipment', 'heater', 'wear'], 2, 'at most 1'],
    [['greenhouses', 0, 'setpoints', 'co2'], 'high', 'a number'],
    [['greenhouses', 0, 'computer'], 'yes', 'true or false'],
    [['greenhouses', 0, 'auto'], true, 'false without a computer'],
  ])('rejects a bad %j, naming the field', (path, value, expected) => {
    const result = restoreGame(editedSave(path, value), defaultContent);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID',
        message: `${pathName(path)} should be ${expected}`,
      },
    });
  });

  it('checks crops against the content it is given', () => {
    const crops = Object.fromEntries(
      Object.entries(defaultContent.crops).filter(([id]) => id !== 'pepper'),
    ) as unknown as GameContent['crops'];
    const save = jsonCopy(plant(newTestGame(), 'pepper'));
    expect(restoreGame(save, { ...defaultContent, crops })).toMatchObject({
      ok: false,
      error: { code: 'INVALID' },
    });
  });
});

describe('migrateState', () => {
  const v1 = { version: 1, coins: 5 };
  const toV2: Migration = ({ coins, ...rest }) => ({
    ...rest,
    version: 2,
    money: coins,
  });
  const toV3: Migration = (old) => ({ ...old, version: 3, settings: {} });

  it('runs every migration from the save version up, in order', () => {
    expect(migrateState(v1, { 1: toV2, 2: toV3 }, 3)).toEqual({
      ok: true,
      value: { version: 3, money: 5, settings: {} },
      fromVersion: 1,
    });
    expect(
      migrateState({ version: 2, money: 1 }, { 1: toV2, 2: toV3 }, 3),
    ).toMatchObject({ ok: true, value: { version: 3, money: 1 } });
  });

  it('never changes the raw save', () => {
    const raw = deepFreeze({ ...v1 });
    expect(() => migrateState(raw, { 1: toV2, 2: toV3 }, 3)).not.toThrow();
    expect(raw).toEqual(v1);
  });

  it('fails without a migration for a version', () => {
    expect(migrateState(v1, { 2: toV3 }, 3)).toMatchObject({
      ok: false,
      error: { code: 'NO_MIGRATION' },
    });
  });

  it('fails when a migration forgets to bump the version', () => {
    const lazy: Migration = (old) => ({ ...old });
    expect(migrateState(v1, { 1: lazy }, 2)).toMatchObject({
      ok: false,
      error: { code: 'INVALID' },
    });
  });

  it('has a migration for every older save version', () => {
    for (let version = 1; version < STATE_VERSION; version++) {
      expect(MIGRATIONS[version], `migration from ${version}`).toBeTypeOf(
        'function',
      );
    }
  });
});
