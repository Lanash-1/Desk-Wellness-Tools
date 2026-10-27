import { isTauri } from '@/platform';

/** Registers the PWA service worker in production browser builds only. */
export function registerServiceWorker(): void {
  if (isTauri() || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {});
}
