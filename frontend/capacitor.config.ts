import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.torinoparking.app",
  appName: "Torino Parking",
  webDir: "dist",
  server: {
    // In production, the app loads from the bundled dist/ files.
    // For dev, uncomment the url below to point to your Vite dev server:
    // url: "http://YOUR_LOCAL_IP:3000",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      backgroundColor: "#1a1a2e",
    },
    StatusBar: {
      style: "DARK",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
