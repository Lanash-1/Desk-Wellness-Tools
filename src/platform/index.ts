import type { Platform } from './types';

export type * from './types';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let platformPromise: Promise<Platform> | null = null;

/**
 * Resolves the platform adapter once. Dynamic imports keep the Tauri JS packages out
 * of the web bundle and vice versa.
 */
export function getPlatform(): Promise<Platform> {
  if (!platformPromise) {
    platformPromise = isTauri()
      ? import('./tauri').then((m) => m.createTauriPlatform())
      : import('./web').then((m) => m.createWebPlatform());
  }
  return platformPromise;
}

/** Test hook. */
export function setPlatform(p: Platform): void {
  platformPromise = Promise.resolve(p);
}
