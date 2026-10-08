import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from './index';

describe('sim package', () => {
  it('exposes a semver version', () => {
    expect(SIM_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
