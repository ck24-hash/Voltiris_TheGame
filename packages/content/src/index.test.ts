import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from './index';

describe('content package', () => {
  it('exposes a semver version', () => {
    expect(CONTENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
