import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const CLOCK_MESSAGE =
  'The sim must be deterministic: read time from the injected Clock.';
const RNG_MESSAGE =
  'The sim must be deterministic: use the seeded RNG stored in GameState.';

export default defineConfig([
  globalIgnores([
    '**/node_modules',
    '**/dist',
    '**/coverage',
    'apps/mobile/android',
    'apps/mobile/ios',
    'apps/mobile/e2e/results',
    'apps/mobile/e2e/report',
  ]),

  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['vitest.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['apps/mobile/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  // Determinism guard: no wall-clock time or unseeded randomness in the sim.
  {
    files: ['packages/sim/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: CLOCK_MESSAGE },
        { object: 'performance', property: 'now', message: CLOCK_MESSAGE },
        { object: 'Math', property: 'random', message: RNG_MESSAGE },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: CLOCK_MESSAGE,
        },
      ],
    },
  },

  prettier,
]);
