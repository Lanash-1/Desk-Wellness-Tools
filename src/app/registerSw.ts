import { isTauri } from '@/platform';
import { useAppStore } from '@/store/appStore';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Browser-only setup: registers the service worker (production builds), asks for
 * persistent storage so IndexedDB is not evicted, and captures the install prompt.
 */
export function registerServiceWorker(): void {
  if (isTauri() || typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const event = e as BeforeInstallPromptEvent;
    useAppStore.getState().setInstallPrompt(async () => {
      await event.prompt();
      const { outcome } = await event.userChoice;
      useAppStore.getState().setInstallPrompt(null);
      return outcome === 'accepted';
    });
  });
  window.addEventListener('appinstalled', () => useAppStore.getState().setInstallPrompt(null));

  if (navigator.storage?.persist) {
    navigator.storage.persisted().then((already) => {
      if (!already) navigator.storage.persist().catch(() => {});
    });
  }

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const update = registerSW({
        immediate: true,
        onNeedRefresh() {
          useAppStore.getState().setUpdate(() => update(true));
        },
      });
    })
    .catch(() => {});
}
