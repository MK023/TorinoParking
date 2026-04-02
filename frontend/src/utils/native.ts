/**
 * Native platform utilities.
 * Wraps Capacitor APIs with graceful fallback for browser usage.
 */
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();

// --- Haptics ---

let hapticsModule: typeof import("@capacitor/haptics") | null = null;

async function getHaptics() {
  if (!isNative) return null;
  if (!hapticsModule) {
    hapticsModule = await import("@capacitor/haptics");
  }
  return hapticsModule.Haptics;
}

export async function hapticLight() {
  const h = await getHaptics();
  h?.impact({ style: hapticsModule!.ImpactStyle.Light });
}

export async function hapticMedium() {
  const h = await getHaptics();
  h?.impact({ style: hapticsModule!.ImpactStyle.Medium });
}

export async function hapticSelection() {
  const h = await getHaptics();
  h?.selectionChanged();
}

export async function hapticNotification(type: "success" | "warning" | "error") {
  const h = await getHaptics();
  if (!h || !hapticsModule) return;
  const map = {
    success: hapticsModule.NotificationType.Success,
    warning: hapticsModule.NotificationType.Warning,
    error: hapticsModule.NotificationType.Error,
  };
  h.notification({ type: map[type] });
}

// --- Network ---

export async function onNetworkChange(callback: (connected: boolean) => void): Promise<() => void> {
  if (!isNative) {
    // Browser fallback
    const onOnline = () => callback(true);
    const onOffline = () => callback(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }

  const { Network } = await import("@capacitor/network");
  const handle = await Network.addListener("networkStatusChange", (status) => {
    callback(status.connected);
  });
  return () => handle.remove();
}

export async function isOnline(): Promise<boolean> {
  if (!isNative) return navigator.onLine;
  const { Network } = await import("@capacitor/network");
  const status = await Network.getStatus();
  return status.connected;
}

// --- Status Bar ---

export async function setStatusBarStyle(dark: boolean) {
  if (!isNative) return;
  const { StatusBar, Style } = await import("@capacitor/status-bar");
  StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
}
