import { createAudio } from './audio';
import type { NotificationActionId, Platform, Unsubscribe } from './types';

type ActionCb = (notificationId: string, action: NotificationActionId | 'click') => void;

function mapPermission(p: globalThis.NotificationPermission): 'granted' | 'denied' | 'prompt' {
  return p === 'default' ? 'prompt' : p;
}

async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export function createWebPlatform(): Platform {
  const base = import.meta.env.BASE_URL;
  const actionListeners = new Set<ActionCb>();
  const openNotifications = new Map<string, Notification>();

  // Actions from service-worker notifications arrive as messages.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data as { type?: string; id?: string; action?: string } | undefined;
      if (data?.type === 'notification-action' && data.id) {
        const action = (data.action || 'click') as NotificationActionId | 'click';
        actionListeners.forEach((cb) => cb(data.id!, action));
      }
    });
  }

  const hasNotifications = typeof Notification !== 'undefined';

  return {
    kind: 'web',
    caps: {
      tray: false,
      autostart: false,
      windowHide: false,
      notificationActions: 'serviceWorker' in navigator,
      reliableBackground: false,
      idle: false,
    },

    notifications: {
      async permission() {
        return hasNotifications ? mapPermission(Notification.permission) : 'denied';
      },
      async request() {
        if (!hasNotifications) return 'denied';
        return mapPermission(await Notification.requestPermission());
      },
      async show(req) {
        if (!hasNotifications || Notification.permission !== 'granted') return;
        const reg = await swRegistration();
        if (reg) {
          await reg.showNotification(req.title, {
            body: req.body,
            tag: req.id,
            icon: `${base}icons/icon-192.png`,
            badge: `${base}icons/icon-192.png`,
            data: { id: req.id },
            // `actions` is only supported for SW notifications and only in some browsers.
            ...(req.actions
              ? { actions: req.actions.map((a) => ({ action: a.id, title: a.label })) }
              : {}),
          } as NotificationOptions);
          return;
        }
        const n = new Notification(req.title, {
          body: req.body,
          tag: req.id,
          icon: `${base}icons/icon-192.png`,
        });
        openNotifications.set(req.id, n);
        n.onclick = () => {
          window.focus();
          actionListeners.forEach((cb) => cb(req.id, 'click'));
          n.close();
        };
        n.onclose = () => openNotifications.delete(req.id);
      },
      onAction(cb): Unsubscribe {
        actionListeners.add(cb);
        return () => actionListeners.delete(cb);
      },
      async close(id) {
        openNotifications.get(id)?.close();
        const reg = await swRegistration();
        if (reg) (await reg.getNotifications({ tag: id })).forEach((n) => n.close());
      },
    },

    audio: createAudio(base),

    heartbeat: {
      subscribe(cb) {
        let worker: Worker | null = null;
        let fallback: ReturnType<typeof setInterval> | null = null;
        try {
          worker = new Worker(new URL('./heartbeat.worker.ts', import.meta.url), {
            type: 'module',
          });
          worker.onmessage = (e: MessageEvent<number>) => cb(e.data);
        } catch {
          fallback = setInterval(() => cb(Date.now()), 1000);
        }
        const onVisible = () => {
          if (document.visibilityState === 'visible') cb(Date.now());
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        return () => {
          worker?.terminate();
          if (fallback) clearInterval(fallback);
          document.removeEventListener('visibilitychange', onVisible);
          window.removeEventListener('focus', onVisible);
        };
      },
    },

    window: {
      async show() {
        window.focus();
      },
      async hide() {
        /* not possible in a browser */
      },
      async isVisible() {
        return document.visibilityState === 'visible';
      },
      onCloseRequested() {
        return () => {};
      },
      setTitle(title) {
        document.title = title;
      },
      setBadge(count) {
        const nav = navigator as Navigator & {
          setAppBadge?: (n: number) => Promise<void>;
          clearAppBadge?: () => Promise<void>;
        };
        if (count > 0) nav.setAppBadge?.(count).catch(() => {});
        else nav.clearAppBadge?.().catch(() => {});
      },
    },

    async openExternal(url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    async quit() {
      window.close();
    },
  };
}
