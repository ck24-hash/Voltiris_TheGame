import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'sim',
          include: ['packages/sim/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'content',
          include: ['packages/content/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      'apps/mobile',
    ],
  },
});
