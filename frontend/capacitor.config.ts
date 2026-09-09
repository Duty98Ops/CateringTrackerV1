import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.binus.cateringtracker',
  appName: 'Catering Tracker',
  webDir: 'out',
  android: {
    allowMixedContent: false,
  },
};

export default config;
