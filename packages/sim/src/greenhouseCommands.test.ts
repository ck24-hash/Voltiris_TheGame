import {
  defaultContent,
  type EquipmentKind,
  type SetpointId,
} from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { applyCommand, type Command } from './commands';
import type { GreenhouseUpgrade } from './equipment';
import type { GameState } from './state';
import {
  accept,
  buy,
  deepFreeze,
  firstGreenhouse,
  newTestGame,
  withGreenhouse,
} from './test-utils';

const content = defaultContent;
const { levels } = content.equipment;
const meta = { id: 'cmd-1', issuedAt: 0 };

function rich(state: GameState = newTestGame()): GameState {
  return { ...state, money: 100_000 };
}

function refused(state: GameState, command: Command) {
  return applyCommand(state, command, content);
}

function buyCommand(state: GameState, kind: EquipmentKind): Command {
  return {
    ...meta,
    type: 'BuyEquipment',
    greenhouseId: firstGreenhouse(state).id,
    kind,
  };
}

function setpointCommand(
  state: GameState,
  setpoint: SetpointId,
  value: number,
): Command {
  return {
    ...meta,
    type: 'SetSetpoint',
    greenhouseId: firstGreenhouse(state).id,
    setpoint,
    value,
  };
}

function upgradeCommand(state: GameState, upgrade: GreenhouseUpgrade): Command {
  return {
    ...meta,
    type: 'UpgradeGreenhouse',
    greenhouseId: firstGreenhouse(state).id,
    upgrade,
  };
}

describe('BuyEquipment', () => {
  it('installs the first level, new, for its price', () => {
    const state = newTestGame();
    const next = buy(state, 'heater');
    expect(firstGreenhouse(next).equipment).toEqual({
      heater: { level: 1, wear: 0 },
    });
    expect(next.money).toBe(state.money - (levels.heater[0]?.price ?? 0));
  });

  it('upgrades to the next level, as good as new', () => {
    const worn = withGreenhouse(buy(rich(), 'vents'), () => ({
      equipment: { vents: { level: 1, wear: 0.6 } },
    }));
    const next = buy(worn, 'vents');
    expect(firstGreenhouse(next).equipment.vents).toEqual({
      level: 2,
      wear: 0,
    });
    expect(next.money).toBe(worn.money - (levels.vents[1]?.price ?? 0));
  });

  it('stops at the top level', () => {
    let state = rich();
    levels.fogger.forEach(() => {
      state = buy(state, 'fogger');
    });
    expect(firstGreenhouse(state).equipment.fogger?.level).toBe(
      levels.fogger.length,
    );
    expect(refused(state, buyCommand(state, 'fogger'))).toMatchObject({
      ok: false,
      error: { code: 'MAX_LEVEL' },
    });
  });

  it.each([
    ['NOT_ENOUGH_MONEY', { money: 0 }, 'heater'],
    ['UNKNOWN_EQUIPMENT', {}, 'laser'],
    ['UNKNOWN_EQUIPMENT', {}, 'toString'],
  ] as const)('rejects with %s', (code, change, kind) => {
    const state = { ...newTestGame(), ...change };
    expect(
      refused(state, buyCommand(state, kind as EquipmentKind)),
    ).toMatchObject({ ok: false, error: { code } });
  });

  it('rejects an unknown greenhouse', () => {
    const state = newTestGame();
    expect(
      refused(state, {
        ...meta,
        type: 'BuyEquipment',
        greenhouseId: 'nope',
        kind: 'co2',
      }),
    ).toMatchObject({ ok: false, error: { code: 'GREENHOUSE_NOT_FOUND' } });
  });
});

describe('ServiceEquipment', () => {
  function serviceCommand(state: GameState, kind: EquipmentKind): Command {
    return {
      ...meta,
      type: 'ServiceEquipment',
      greenhouseId: firstGreenhouse(state).id,
      kind,
    };
  }

  const worn = withGreenhouse(buy(newTestGame(), 'heater'), () => ({
    equipment: { heater: { level: 1, wear: 0.5 } },
  }));

  it('costs a share of the price, rounded up, by how worn it is', () => {
    const next = accept(worn, serviceCommand(worn, 'heater'));
    const price = levels.heater[0]?.price ?? 0;
    expect(next.money).toBe(
      worn.money - Math.ceil(price * content.equipment.serviceShare * 0.5),
    );
    expect(firstGreenhouse(next).equipment.heater).toEqual({
      level: 1,
      wear: 0,
    });
  });

  it.each([
    ['NOT_INSTALLED', worn, 'co2'],
    ['NOT_WORN', buy(newTestGame(), 'heater'), 'heater'],
    ['NOT_ENOUGH_MONEY', { ...worn, money: 0 }, 'heater'],
    ['UNKNOWN_EQUIPMENT', worn, 'laser'],
  ] as const)('rejects with %s', (code, state, kind) => {
    expect(
      refused(state, serviceCommand(state, kind as EquipmentKind)),
    ).toMatchObject({ ok: false, error: { code } });
  });
});

describe('SetSetpoint', () => {
  it('sets a target', () => {
    const state = newTestGame();
    const next = accept(state, setpointCommand(state, 'co2', 950));
    expect(firstGreenhouse(next).setpoints).toEqual({
      ...firstGreenhouse(state).setpoints,
      co2: 950,
    });
    expect(next.money).toBe(state.money);
  });

  it.each([
    ['heatTo', 27, 'ventAbove', 28],
    ['ventAbove', 18, 'heatTo', 17],
    ['humidityMin', 85, 'humidityMax', 90],
    ['humidityMax', 60, 'humidityMin', 55],
  ] as const)(
    'moving %s to %d pushes %s to %d, keeping heating below venting',
    (setpoint, value, partner, pushed) => {
      const state = newTestGame();
      const next = accept(state, setpointCommand(state, setpoint, value));
      expect(firstGreenhouse(next).setpoints).toMatchObject({
        [setpoint]: value,
        [partner]: pushed,
      });
    },
  );

  it('leaves the partner where it is when the gap is already wide enough', () => {
    const state = newTestGame();
    const next = accept(state, setpointCommand(state, 'heatTo', 18));
    expect(firstGreenhouse(next).setpoints.ventAbove).toBe(
      content.control.initial.ventAbove,
    );
  });

  it.each([
    ['INVALID_AMOUNT', 'heatTo', 45],
    ['INVALID_AMOUNT', 'co2', -1],
    ['INVALID_AMOUNT', 'light', Number.NaN],
    ['UNKNOWN_SETPOINT', 'speed', 1],
  ] as const)('rejects with %s (%s = %d)', (code, setpoint, value) => {
    const state = newTestGame();
    expect(
      refused(state, setpointCommand(state, setpoint as SetpointId, value)),
    ).toMatchObject({ ok: false, error: { code } });
  });
});

describe('SetAutoControl', () => {
  function autoCommand(state: GameState, auto: boolean): Command {
    return {
      ...meta,
      type: 'SetAutoControl',
      greenhouseId: firstGreenhouse(state).id,
      auto,
    };
  }

  it('needs a climate computer', () => {
    const state = newTestGame();
    expect(refused(state, autoCommand(state, true))).toMatchObject({
      ok: false,
      error: { code: 'NO_COMPUTER' },
    });
  });

  it('hands the targets to the player and back', () => {
    const state = accept(rich(), upgradeCommand(rich(), 'computer'));
    expect(firstGreenhouse(state).auto).toBe(true);
    const manual = accept(state, autoCommand(state, false));
    expect(firstGreenhouse(manual).auto).toBe(false);
    expect(
      firstGreenhouse(accept(manual, autoCommand(manual, true))).auto,
    ).toBe(true);
  });
});

describe('UpgradeGreenhouse', () => {
  it('fits the next glass, then stops at the best', () => {
    let state = rich();
    for (let level = 2; level <= content.greenhouse.glass.length; level++) {
      const before = state.money;
      state = accept(state, upgradeCommand(state, 'glass'));
      expect(firstGreenhouse(state).glass).toBe(level);
      expect(state.money).toBe(
        before - (content.greenhouse.glass[level - 1]?.price ?? 0),
      );
    }
    expect(refused(state, upgradeCommand(state, 'glass'))).toMatchObject({
      ok: false,
      error: { code: 'MAX_LEVEL' },
    });
  });

  it('grows the greenhouse with new empty plots, keeping the old ones', () => {
    const state = rich();
    const next = accept(state, upgradeCommand(state, 'size'));
    const [, medium] = content.greenhouse.sizes;
    const before = firstGreenhouse(state).plots;
    const after = firstGreenhouse(next).plots;
    expect(firstGreenhouse(next).size).toBe(2);
    expect(after).toHaveLength(medium?.plots ?? -1);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.slice(before.length).every((p) => p.planting === null)).toBe(
      true,
    );
    // New ids come from the seeded rng.
    expect(new Set(after.map((p) => p.id)).size).toBe(after.length);
    expect(next.rng).not.toEqual(state.rng);
    expect(accept(state, upgradeCommand(state, 'size'))).toEqual(next);
  });

  it('installs a climate computer once, on auto', () => {
    const state = rich();
    const next = accept(state, upgradeCommand(state, 'computer'));
    expect(firstGreenhouse(next)).toMatchObject({ computer: true, auto: true });
    expect(next.money).toBe(
      state.money - content.greenhouse.climateComputer.price,
    );
    expect(refused(next, upgradeCommand(next, 'computer'))).toMatchObject({
      ok: false,
      error: { code: 'MAX_LEVEL' },
    });
  });

  it.each([
    ['NOT_ENOUGH_MONEY', 'size'],
    ['UNKNOWN_UPGRADE', 'roof'],
  ] as const)('rejects with %s', (code, upgrade) => {
    const state = newTestGame();
    expect(
      refused(
        { ...state, money: 0 },
        upgradeCommand(state, upgrade as GreenhouseUpgrade),
      ),
    ).toMatchObject({ ok: false, error: { code } });
  });
});

describe('every greenhouse command', () => {
  it('leaves the input state untouched', () => {
    const state = deepFreeze(
      withGreenhouse(buy(rich(), 'heater'), () => ({
        equipment: { heater: { level: 1, wear: 0.3 } },
        computer: true,
      })),
    );
    const greenhouseId = firstGreenhouse(state).id;
    expect(() => {
      accept(state, buyCommand(state, 'heater'));
      accept(state, {
        ...meta,
        type: 'ServiceEquipment',
        greenhouseId,
        kind: 'heater',
      });
      accept(state, setpointCommand(state, 'heatTo', 28));
      accept(state, {
        ...meta,
        type: 'SetAutoControl',
        greenhouseId,
        auto: false,
      });
      accept(state, upgradeCommand(state, 'glass'));
      accept(state, upgradeCommand(state, 'size'));
    }).not.toThrow();
  });
});
