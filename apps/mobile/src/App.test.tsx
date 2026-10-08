import { cleanup, render, screen } from '@testing-library/react';
import { SIM_VERSION } from '@voltiris/sim';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

describe('App', () => {
  it('renders the title and the sim version', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Voltiris: The Game' }),
    ).toBeDefined();
    expect(screen.getByText(`Simulation engine v${SIM_VERSION}`)).toBeDefined();
  });
});
