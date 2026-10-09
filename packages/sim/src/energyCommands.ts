import { ENERGY_ASSETS, type GameContent } from '@voltiris/content';
import { record } from './books';
import { fail } from './commandHelpers';
import type { BuyEnergyCommand, CommandResult } from './commands';
import type { GameState } from './state';

export function buyEnergy(
  state: GameState,
  command: BuyEnergyCommand,
  content: GameContent,
): CommandResult {
  const { asset } = command;
  // Commands may come from untrusted input later, so check the name at runtime.
  if (!(ENERGY_ASSETS as readonly string[]).includes(asset)) {
    return fail('UNKNOWN_EQUIPMENT', `Unknown energy asset "${asset}"`);
  }
  const level = state.energy[asset] + 1;
  const next = content.energy[asset][level - 1];
  if (!next) return fail('MAX_LEVEL', `The ${asset} is at its top level`);
  if (state.money < next.price) {
    return fail('NOT_ENOUGH_MONEY', `It costs ${next.price}`);
  }
  // A bigger battery keeps the charge it had.
  return {
    ok: true,
    state: record(
      {
        ...state,
        money: state.money - next.price,
        energy: { ...state.energy, [asset]: level },
      },
      { purchases: next.price },
    ),
  };
}
