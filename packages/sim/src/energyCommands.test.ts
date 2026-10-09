import { defaultContent, type EnergyAsset } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { applyCommand, type Command } from './commands';
import type { GameState } from './state';
import { accept, deepFreeze, newTestGame, withEnergy } from './test-utils';

const content = defaultContent;

function buyCommand(asset: EnergyAsset): Command {
  return { type: 'BuyEnergy', id: 'cmd-1', issuedAt: 0, asset };
}

const rich = (): GameState => ({ ...newTestGame(), money: 100_000 });

describe('BuyEnergy', () => {
  it.each(['solar', 'battery', 'chp'] as const)(
    'builds %s, then upgrades it level by level',
    (asset) => {
      let state = rich();
      for (const [k, level] of content.energy[asset].entries()) {
        const before = state.money;
        state = accept(state, buyCommand(asset));
        expect(state.energy[asset]).toBe(k + 1);
        expect(state.money).toBe(before - level.price);
      }
      expect(applyCommand(state, buyCommand(asset), content)).toMatchObject({
        ok: false,
        error: { code: 'MAX_LEVEL' },
      });
    },
  );

  it('keeps the charge of a battery it upgrades', () => {
    const state = withEnergy(rich(), { battery: 1, stored: 7 });
    expect(accept(state, buyCommand('battery')).energy).toMatchObject({
      battery: 2,
      stored: 7,
    });
  });

  it.each([
    ['NOT_ENOUGH_MONEY', 'solar', 0],
    ['UNKNOWN_EQUIPMENT', 'windmill', 100_000],
    ['UNKNOWN_EQUIPMENT', 'today', 100_000],
  ] as const)('rejects with %s (%s)', (code, asset, money) => {
    const state = { ...newTestGame(), money };
    expect(
      applyCommand(state, buyCommand(asset as EnergyAsset), content),
    ).toMatchObject({ ok: false, error: { code } });
  });

  it('leaves the input state untouched', () => {
    const state = deepFreeze(rich());
    expect(() => accept(state, buyCommand('chp'))).not.toThrow();
  });
});
