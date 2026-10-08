import {
  CLIMATE_VARIABLES,
  type Climate,
  type CropId,
  type GameContent,
} from '@voltiris/content';
import {
  STATE_VERSION,
  type GameState,
  type Greenhouse,
  type Planting,
  type Plot,
} from './state';

/** A saved game as raw JSON data, before it is checked. */
export type RawState = Readonly<Record<string, unknown>>;

/**
 * Upgrades a raw saved game by one version: `MIGRATIONS[n]` turns a version n
 * save into a version n + 1 save. It returns a new object with `version: n + 1`
 * and never changes its input.
 */
export type Migration = (old: RawState) => RawState;

/** Add one entry here, with a test, every time STATE_VERSION goes up. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export type RestoreErrorCode =
  'NOT_A_SAVE' | 'TOO_NEW' | 'NO_MIGRATION' | 'INVALID';

export interface RestoreError {
  readonly code: RestoreErrorCode;
  readonly message: string;
}

export type MigrateResult =
  | {
      readonly ok: true;
      readonly value: RawState;
      readonly fromVersion: number;
    }
  | { readonly ok: false; readonly error: RestoreError };

export type RestoreResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly fromVersion: number;
    }
  | { readonly ok: false; readonly error: RestoreError };

/** Brings a raw saved game up to `targetVersion`, one migration at a time. */
export function migrateState(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  targetVersion: number = STATE_VERSION,
): MigrateResult {
  if (!isRecord(raw)) return fail('NOT_A_SAVE', 'A saved game is an object');
  const fromVersion = raw.version;
  if (typeof fromVersion !== 'number' || !Number.isInteger(fromVersion)) {
    return fail('NOT_A_SAVE', 'The save has no version number');
  }
  if (fromVersion < 1) {
    return fail('INVALID', `Unknown save version ${fromVersion}`);
  }
  if (fromVersion > targetVersion) {
    return fail(
      'TOO_NEW',
      `Save version ${fromVersion} is newer than this game (version ${targetVersion})`,
    );
  }

  let value: RawState = raw;
  for (let version = fromVersion; version < targetVersion; version++) {
    const migration = migrations[version];
    if (!migration) {
      return fail('NO_MIGRATION', `No migration from save version ${version}`);
    }
    value = migration(value);
    if (value.version !== version + 1) {
      return fail(
        'INVALID',
        `The migration from version ${version} did not produce version ${version + 1}`,
      );
    }
  }
  return { ok: true, value, fromVersion };
}

/**
 * Turns a saved game (raw JSON data) back into a GameState: migrates an old
 * save to the current version, then checks every field, so a damaged or
 * edited save never reaches the sim. Unknown extra fields are dropped.
 */
export function restoreGame(raw: unknown, content: GameContent): RestoreResult {
  const migrated = migrateState(raw);
  if (!migrated.ok) return migrated;
  try {
    return {
      ok: true,
      state: readGameState(migrated.value, content),
      fromVersion: migrated.fromVersion,
    };
  } catch (error) {
    if (error instanceof InvalidSave) return fail('INVALID', error.message);
    throw error;
  }
}

function fail(
  code: RestoreErrorCode,
  message: string,
): { readonly ok: false; readonly error: RestoreError } {
  return { ok: false, error: { code, message } };
}

class InvalidSave extends Error {}

function invalid(path: string, expected: string): never {
  throw new InvalidSave(`${path} should be ${expected}`);
}

function isRecord(value: unknown): value is RawState {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, path: string): RawState {
  if (!isRecord(value)) invalid(path, 'an object');
  return value;
}

function list(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) invalid(path, 'a list');
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value === '') {
    invalid(path, 'a non-empty string');
  }
  return value;
}

function number(value: unknown, path: string, min = -Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    invalid(path, min === -Infinity ? 'a number' : `a number from ${min} up`);
  }
  return value;
}

function wholeNumber(value: unknown, path: string, min: number): number {
  const n = number(value, path, min);
  if (!Number.isInteger(n)) invalid(path, 'a whole number');
  return n;
}

function uint32(value: unknown, path: string): number {
  const n = wholeNumber(value, path, 0);
  if (n >= 2 ** 32) invalid(path, 'an unsigned 32-bit integer');
  return n;
}

function cropId(value: unknown, path: string, content: GameContent): CropId {
  if (typeof value !== 'string' || !Object.hasOwn(content.crops, value)) {
    invalid(path, 'a known crop');
  }
  return value as CropId;
}

function readGameState(raw: RawState, content: GameContent): GameState {
  const clock = record(raw.clock, 'clock');
  const rng = record(raw.rng, 'rng');
  return {
    version: wholeNumber(raw.version, 'version', STATE_VERSION),
    playerId: text(raw.playerId, 'playerId'),
    clock: {
      gameHour: wholeNumber(clock.gameHour, 'clock.gameHour', 0),
      lastTickAt: number(clock.lastTickAt, 'clock.lastTickAt'),
    },
    rng: {
      seed: uint32(rng.seed, 'rng.seed'),
      state: uint32(rng.state, 'rng.state'),
    },
    money: number(raw.money, 'money'),
    greenhouses: list(raw.greenhouses, 'greenhouses').map((g, k) =>
      readGreenhouse(g, `greenhouses[${k}]`, content),
    ),
  };
}

function readGreenhouse(
  raw: unknown,
  path: string,
  content: GameContent,
): Greenhouse {
  const greenhouse = record(raw, path);
  const climate = record(greenhouse.climate, `${path}.climate`);
  return {
    id: text(greenhouse.id, `${path}.id`),
    climate: Object.fromEntries(
      CLIMATE_VARIABLES.map((v) => [
        v,
        number(climate[v], `${path}.climate.${v}`),
      ]),
    ) as Climate,
    plots: list(greenhouse.plots, `${path}.plots`).map((p, k) =>
      readPlot(p, `${path}.plots[${k}]`, content),
    ),
  };
}

function readPlot(raw: unknown, path: string, content: GameContent): Plot {
  const plot = record(raw, path);
  return {
    id: text(plot.id, `${path}.id`),
    planting:
      plot.planting === null
        ? null
        : readPlanting(plot.planting, `${path}.planting`, content),
  };
}

function readPlanting(
  raw: unknown,
  path: string,
  content: GameContent,
): Planting {
  const planting = record(raw, path);
  const base = {
    cropId: cropId(planting.cropId, `${path}.cropId`, content),
    plantedAtHour: wholeNumber(
      planting.plantedAtHour,
      `${path}.plantedAtHour`,
      0,
    ),
    growthHours: number(planting.growthHours, `${path}.growthHours`, 0),
    stress: number(planting.stress, `${path}.stress`, 0),
  };
  switch (planting.status) {
    case 'growing':
      return { status: 'growing', ...base };
    case 'ready': {
      const quality = number(planting.quality, `${path}.quality`, 0);
      if (quality > 1) invalid(`${path}.quality`, 'at most 1');
      return {
        status: 'ready',
        ...base,
        readyAtHour: wholeNumber(
          planting.readyAtHour,
          `${path}.readyAtHour`,
          0,
        ),
        quality,
        yieldUnits: number(planting.yieldUnits, `${path}.yieldUnits`, 0),
      };
    }
    default:
      return invalid(`${path}.status`, '"growing" or "ready"');
  }
}
