import type { CommandError, CommandErrorCode } from '@voltiris/sim';

/** What to tell the player when the sim refuses a command they can make. */
const MESSAGES: Partial<Record<CommandErrorCode, string>> = {
  NOT_ENOUGH_MONEY: 'Not enough Volticoins.',
  STORAGE_FULL: 'Storage is full. Sell some produce at the market first.',
  ALREADY_FULL: 'It cannot hold any more.',
  NOT_ENOUGH_STOCK: 'There is not that much in storage.',
  NOT_READY: 'Still growing.',
};

export function describeCommandError(error: CommandError): string {
  return MESSAGES[error.code] ?? error.message;
}
