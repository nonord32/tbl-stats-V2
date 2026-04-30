import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tblstats.app',
  appName: 'TBL Stats',
  webDir: 'public',
  server: {
    url: 'https://tblstats.com',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: '#f4ede0',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#f4ede0',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#f4ede0',
      overlaysWebView: false,
    },
  },
};

export default config;
