import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Oldest engines the game runs in: Android WebView and iOS 16.4 (the app's minimum). */
const ENGINES = ['chrome107', 'safari16.4'];

export default defineConfig({
  plugins: [react()],
  build: {
    target: ENGINES,
    cssTarget: ENGINES,
  },
  test: {
    name: 'mobile',
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
