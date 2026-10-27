import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { usePlatform } from '@/app/usePlatform';
import type { NotificationPermission } from '@/platform';

const DISMISS_KEY = 'deskwellness.notificationBannerDismissed';

/**
 * First-run prompt to enable notifications. Permission can only be requested from a user
 * gesture, so this is a button, not an automatic request.
 */
export function NotificationBanner() {
  const platform = usePlatform();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    platform.notifications.permission().then(setPermission);
  }, [platform]);

  if (!permission || permission === 'granted' || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div>
        <p className="font-medium">
          {permission === 'denied' ? 'Notifications are blocked' : 'Turn on notifications'}
        </p>
        <p className="opacity-80">
          {permission === 'denied'
            ? 'Allow notifications for this app in your browser or system settings so reminders can reach you.'
            : 'Reminders and timer alerts need permission to show up when this window is in the background.'}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {permission === 'prompt' && (
          <Button onClick={async () => setPermission(await platform.notifications.request())}>
            Enable notifications
          </Button>
        )}
        <Button variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
