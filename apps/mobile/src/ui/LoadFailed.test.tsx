import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadFailed } from './LoadFailed';

afterEach(cleanup);

const BROKEN = { format: 'voltiris-save', game: 1 };

function renderScreen(raw: unknown) {
  const onExport = vi.fn(() => Promise.resolve('shared' as const));
  const onNewGame = vi.fn();
  render(
    <LoadFailed
      error={{ code: 'TOO_NEW', message: 'Save version 9 is newer' }}
      raw={raw}
      onExport={onExport}
      onNewGame={onNewGame}
    />,
  );
  return { onExport, onNewGame };
}

describe('LoadFailed', () => {
  it('explains the problem in plain words', () => {
    renderScreen(BROKEN);
    expect(
      screen.getByRole('dialog', { name: 'Save problem' }),
    ).toHaveTextContent('This save comes from a newer version of the game.');
  });

  it('lets the player export the broken save first', async () => {
    const user = userEvent.setup();
    const { onExport } = renderScreen(BROKEN);
    await user.click(screen.getByRole('button', { name: 'Export the save' }));
    expect(onExport).toHaveBeenCalledWith(JSON.stringify(BROKEN, null, 2));
    expect(await screen.findByText('Save shared.')).toBeDefined();
  });

  it('only replaces the save after a confirmation', async () => {
    const user = userEvent.setup();
    const { onNewGame } = renderScreen(BROKEN);
    await user.click(screen.getByRole('button', { name: 'Start a new game' }));
    expect(onNewGame).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, start over' }));
    expect(onNewGame).toHaveBeenCalledOnce();
  });

  it('offers no export when the storage could not be read', () => {
    renderScreen(undefined);
    expect(
      screen.queryByRole('button', { name: 'Export the save' }),
    ).toBeNull();
  });
});
