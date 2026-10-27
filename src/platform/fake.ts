import type { NotificationActionId, NotificationRequest, Platform } from './types';

/**
 * In-memory Platform used by unit tests. Records everything and lets tests drive
 * the heartbeat and notification actions by hand.
 */
export interface FakePlatform extends Platform {
  shown: NotificationRequest[];
  played: { soundId: string; volume: number }[];
  permissionState: 'granted' | 'denied' | 'prompt';
  tick(now: number): void;
  fireAction(id: string, action: NotificationActionId | 'click'): void;
}

export function createFakePlatform(): FakePlatform {
  const heartbeatSubs = new Set<(now: number) => void>();
  const actionSubs = new Set<(id: string, action: NotificationActionId | 'click') => void>();

  const fake: FakePlatform = {
    kind: 'web',
    caps: {
      tray: false,
      autostart: false,
      windowHide: false,
      notificationActions: true,
      reliableBackground: true,
      idle: false,
    },
    shown: [],
    played: [],
    permissionState: 'granted',
    tick(now) {
      heartbeatSubs.forEach((cb) => cb(now));
    },
    fireAction(id, action) {
      actionSubs.forEach((cb) => cb(id, action));
    },
    notifications: {
      permission: async () => fake.permissionState,
      request: async () => {
        if (fake.permissionState === 'prompt') fake.permissionState = 'granted';
        return fake.permissionState;
      },
      show: async (req) => {
        fake.shown.push(req);
      },
      onAction: (cb) => {
        actionSubs.add(cb);
        return () => actionSubs.delete(cb);
      },
      close: async () => {},
    },
    audio: {
      play: async (soundId, volume) => {
        fake.played.push({ soundId, volume });
      },
      unlock: () => {},
    },
    heartbeat: {
      subscribe: (cb) => {
        heartbeatSubs.add(cb);
        return () => heartbeatSubs.delete(cb);
      },
    },
    window: {
      show: async () => {},
      hide: async () => {},
      isVisible: async () => true,
      onCloseRequested: () => () => {},
      setTitle: () => {},
      setBadge: () => {},
    },
    openExternal: async () => {},
    quit: async () => {},
  };
  return fake;
}
