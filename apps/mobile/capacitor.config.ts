import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.voltiris.thegame',
  appName: 'Voltiris: The Game',
  webDir: 'dist',
  plugins: {
    // The game runs full screen; the system bars stay hidden.
    SystemBars: { hidden: true },
  },
};

export default config;
