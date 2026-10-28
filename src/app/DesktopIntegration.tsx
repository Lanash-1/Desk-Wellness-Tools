import { useEffect, useRef } from 'react';
import { usePlatform } from './usePlatform';
import { useSettings } from './useSettings';
import { getDb } from '@/storage/db';

const TRAY_HINT_KEY = 'trayHintShown';

/**
 * Desktop-only behaviour: close-to-tray (with a one-time hint) and Dock visibility.
 * Renders nothing; mounted once inside HeartbeatProvider.
 */
export function DesktopIntegration() {
  const platform = usePlatform();
  const settings = useSettings();
  const closeToTray = settings?.desktop.closeToTray ?? true;
  const closeToTrayRef = useRef(closeToTray);
  useEffect(() => {
    closeToTrayRef.current = closeToTray;
  }, [closeToTray]);

  useEffect(() => {
    if (!platform.caps.windowHide) return;
    return platform.window.onCloseRequested(() => {
      if (!closeToTrayRef.current) return false;
      void (async () => {
        await platform.window.hide();
        const db = getDb();
        if (!(await db.meta.get(TRAY_HINT_KEY))) {
          await db.meta.put({ key: TRAY_HINT_KEY, value: '1' });
          await platform.notifications.show({
            id: 'tray-hint',
            title: 'Desk Wellness keeps running',
            body: 'Reminders continue from the tray. Use the tray menu or Settings to quit.',
          });
        }
      })();
      return true;
    });
  }, [platform]);

  useEffect(() => {
    if (!platform.caps.dockIcon || !platform.setDockVisible || !settings) return;
    void platform.setDockVisible(settings.desktop.showDockIcon);
  }, [platform, settings]);

  return null;
}
