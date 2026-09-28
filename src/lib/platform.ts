interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

/** True inside the Capacitor iOS/Android shell (window.Capacitor is injected by the native bridge). */
export function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** The same-origin proxy only exists when served by the Vite/Node server, never inside the native app. */
export function proxyAvailable(): boolean {
  return !isNativeApp();
}
