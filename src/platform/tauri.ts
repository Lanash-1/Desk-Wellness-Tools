import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  onAction,
} from '@tauri-apps/plugin-notification';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { openUrl } from '@tauri-apps/plugin-opener';
import { createAudio } from './audio';
import type { NotificationActionId, Platform, TrayMenuItem, TrayState } from './types';

type ActionCb = (notificationId: string, action: NotificationActionId | 'click') => void;

export function createTauriPlatform(): Platform {
  const win = getCurrentWindow();
  const actionListeners = new Set<ActionCb>();
  const menuListeners = new Set<(id: string) => void>();

  // Notification clicks (desktop plugins deliver these inconsistently; the in-app
  // reminder card is the primary UI, this is a bonus).
  onAction((performed) => {
    const extraId = performed.notification?.extra?.id;
    const id = typeof extraId === 'string' ? extraId : String(performed.notification?.id ?? '');
    const action: NotificationActionId | 'click' =
      performed.actionId === 'done' ||
      performed.actionId === 'snooze' ||
      performed.actionId === 'dismiss'
        ? performed.actionId
        : 'click';
    if (id) actionListeners.forEach((cb) => cb(id, action));
  }).catch(() => {});

  listen<string>('tray-menu', (e) => menuListeners.forEach((cb) => cb(e.payload))).catch(() => {});

  return {
    kind: 'tauri',
    caps: {
      tray: true,
      autostart: true,
      windowHide: true,
      notificationActions: false,
      reliableBackground: true,
      idle: false,
    },

    notifications: {
      async permission() {
        return (await isPermissionGranted()) ? 'granted' : 'prompt';
      },
      async request() {
        const result = await requestPermission();
        return result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'prompt';
      },
      async show(req) {
        if (!(await isPermissionGranted())) return;
        sendNotification({ title: req.title, body: req.body, extra: { id: req.id } });
      },
      onAction(cb) {
        actionListeners.add(cb);
        return () => actionListeners.delete(cb);
      },
      async close() {
        /* not supported by the plugin on desktop */
      },
    },

    audio: createAudio(import.meta.env.BASE_URL),

    heartbeat: {
      subscribe(cb) {
        let unlisten: (() => void) | null = null;
        // Rust emits `heartbeat` every second; it keeps ticking while the window is hidden.
        listen<number>('heartbeat', () => cb(Date.now()))
          .then((u) => (unlisten = u))
          .catch(() => {});
        // Safety net in case the event stream stalls.
        const interval = setInterval(() => cb(Date.now()), 5000);
        const onFocus = () => cb(Date.now());
        window.addEventListener('focus', onFocus);
        return () => {
          unlisten?.();
          clearInterval(interval);
          window.removeEventListener('focus', onFocus);
        };
      },
    },

    window: {
      async show() {
        await win.show();
        await win.unminimize();
        await win.setFocus();
      },
      async hide() {
        await win.hide();
      },
      async isVisible() {
        return win.isVisible();
      },
      onCloseRequested(cb) {
        let unlisten: (() => void) | null = null;
        win
          .onCloseRequested((event) => {
            if (cb()) event.preventDefault();
          })
          .then((u) => (unlisten = u))
          .catch(() => {});
        return () => unlisten?.();
      },
      setTitle(title) {
        win.setTitle(title).catch(() => {});
      },
      setBadge(count) {
        win.setBadgeCount(count > 0 ? count : undefined).catch(() => {});
      },
    },

    tray: {
      async setTooltip(text) {
        await invoke('tray_set_tooltip', { text });
      },
      async setState(state: TrayState) {
        await invoke('tray_set_state', { state });
      },
      async setMenu(items: TrayMenuItem[]) {
        await invoke('tray_set_menu', { items });
      },
      onMenuClick(cb) {
        menuListeners.add(cb);
        return () => menuListeners.delete(cb);
      },
    },

    autostart: {
      isEnabled: () => isEnabled(),
      async set(enabled) {
        if (enabled) await enable();
        else await disable();
      },
    },

    async openExternal(url) {
      await openUrl(url);
    },
    async quit() {
      await invoke('quit_app');
    },
  };
}
