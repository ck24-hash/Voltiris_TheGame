import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.voltiris.thegame',
  appName: 'Voltiris: The Game',
  webDir: 'dist',
  // Meadow green behind the web view while the game loads.
  backgroundColor: '#8bc962',
  ios: {
    // The map pans itself; the page must never bounce or scroll.
    scrollEnabled: false,
  },
  plugins: {
    // The game runs full screen: status bar and home indicator hidden.
    SystemBars: { hidden: true },
  },
};

export default config;
