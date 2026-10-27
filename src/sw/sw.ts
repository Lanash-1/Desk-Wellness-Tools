/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// Injected by vite-plugin-pwa at build time.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/**
 * Notification clicks and action buttons are routed back to the page as a message.
 * If no window is open we open one; the app reconciles state on load.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const id = (event.notification.data as { id?: string } | undefined)?.id ?? event.notification.tag;
  const action = event.action || 'click';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const message = { type: 'notification-action', id, action };
      if (windows.length > 0) {
        windows.forEach((w) => w.postMessage(message));
        const focusable = windows[0];
        if ('focus' in focusable) await focusable.focus();
      } else {
        const scope = self.registration.scope;
        const client = await self.clients.openWindow(scope);
        // The new page won't have listeners yet; it reconciles from stored state instead.
        client?.postMessage(message);
      }
    })(),
  );
});
