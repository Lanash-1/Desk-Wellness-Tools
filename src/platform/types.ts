/**
 * Platform adapter. Everything that differs between the Tauri desktop shell and the
 * browser lives behind this interface so the rest of the app stays platform-agnostic.
 *
 * Implementations: ./tauri.ts, ./web.ts, ./fake.ts (tests).
 */

export type PlatformKind = 'tauri' | 'web';

export type NotificationPermission = 'granted' | 'denied' | 'prompt';

export type NotificationActionId = 'done' | 'snooze' | 'dismiss';

export interface NotificationRequest {
  /** Stable id so a later action/click can be routed back to the reminder. */
  id: string;
  title: string;
  body: string;
  actions?: { id: NotificationActionId; label: string }[];
}

export type Unsubscribe = () => void;

export type TrayState = 'idle' | 'focus' | 'break' | 'paused';

export interface TrayMenuItem {
  id: string;
  label: string;
  enabled?: boolean;
}

export interface PlatformCapabilities {
  tray: boolean;
  autostart: boolean;
  windowHide: boolean;
  notificationActions: boolean;
  /** True when the scheduler keeps running with the UI hidden (desktop). */
  reliableBackground: boolean;
  idle: boolean;
}

export interface Platform {
  readonly kind: PlatformKind;
  readonly caps: PlatformCapabilities;

  notifications: {
    permission(): Promise<NotificationPermission>;
    /** Must be called from a user gesture on the web. */
    request(): Promise<NotificationPermission>;
    show(request: NotificationRequest): Promise<void>;
    /** `action` is one of the request's action ids, or 'click' for a plain tap. */
    onAction(
      cb: (notificationId: string, action: NotificationActionId | 'click') => void,
    ): Unsubscribe;
    close(notificationId: string): Promise<void>;
  };

  audio: {
    /** Plays a bundled sound by id (see public/sounds). Resolves when playback starts. */
    play(soundId: string, volume: number): Promise<void>;
    /** Unlocks audio playback; call from the first user gesture. */
    unlock(): void;
  };

  heartbeat: {
    /** Calls back roughly once per second, including while the UI is hidden where possible. */
    subscribe(cb: (now: number) => void): Unsubscribe;
  };

  window: {
    show(): Promise<void>;
    hide(): Promise<void>;
    isVisible(): Promise<boolean>;
    /** Return true from cb to prevent the close (used for close-to-tray). */
    onCloseRequested(cb: () => boolean): Unsubscribe;
    /** Mirrors the timer in the title bar / tab title. */
    setTitle(title: string): void;
    /** Numeric app badge (PWA / dock). 0 clears it. */
    setBadge(count: number): void;
  };

  tray?: {
    setTooltip(text: string): Promise<void>;
    setState(state: TrayState): Promise<void>;
    setMenu(items: TrayMenuItem[]): Promise<void>;
    onMenuClick(cb: (itemId: string) => void): Unsubscribe;
  };

  autostart?: {
    isEnabled(): Promise<boolean>;
    set(enabled: boolean): Promise<void>;
  };

  idle?: {
    idleSeconds(): Promise<number>;
  };

  openExternal(url: string): Promise<void>;
  quit(): Promise<void>;
}
