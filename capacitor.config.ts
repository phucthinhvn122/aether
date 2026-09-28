import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.aether.chat',
  appName: 'Aether',
  webDir: 'dist',
  backgroundColor: '#faf8f5',
  ios: {
    // The web layer handles safe areas itself via env(safe-area-inset-*).
    contentInset: 'never',
    backgroundColor: '#faf8f5',
  },
};

export default config;
