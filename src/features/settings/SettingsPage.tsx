import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { Toggle } from '@/components/Toggle';
import { usePlatform } from '@/app/usePlatform';
import { useSettings } from '@/app/useSettings';
import { REMINDER_KINDS, type ThemePreference } from '@/core/models';
import { REMINDER_LABELS } from '@/core/settings/defaults';
import { updateSettings } from '@/storage/settings';
import type { NotificationPermission } from '@/platform';

export function SettingsPage() {
  const settings = useSettings();
  const platform = usePlatform();
  const [permission, setPermission] = useState<NotificationPermission>('prompt');

  useEffect(() => {
    platform.notifications.permission().then(setPermission);
  }, [platform]);

  if (!settings) return null;

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-4">
        <Card title="Notifications">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>
              Permission: <strong>{permission}</strong>
            </span>
            {permission !== 'granted' && (
              <button
                type="button"
                className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white"
                onClick={async () => setPermission(await platform.notifications.request())}
              >
                Enable notifications
              </button>
            )}
            {permission === 'granted' && (
              <button
                type="button"
                className="rounded-full border border-slate-300 px-4 py-1.5 text-sm dark:border-slate-700"
                onClick={() =>
                  platform.notifications.show({
                    id: 'test',
                    title: 'Desk Wellness',
                    body: 'Notifications are working.',
                  })
                }
              >
                Send test
              </button>
            )}
          </div>
          <Toggle
            label="Sounds"
            checked={settings.sound.enabled}
            onChange={(enabled) => updateSettings({ sound: { ...settings.sound, enabled } })}
          />
        </Card>

        <Card title="Reminders">
          {REMINDER_KINDS.map((kind) => (
            <Toggle
              key={kind}
              label={REMINDER_LABELS[kind].title}
              description={`Every ${settings.reminders[kind].intervalMin} minutes`}
              checked={settings.reminders[kind].enabled}
              onChange={(enabled) =>
                updateSettings({
                  reminders: {
                    ...settings.reminders,
                    [kind]: { ...settings.reminders[kind], enabled },
                  },
                })
              }
            />
          ))}
        </Card>

        <Card title="Appearance">
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Theme</span>
            <select
              className="rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 dark:border-slate-700"
              value={settings.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as ThemePreference })}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </Card>

        {platform.caps.autostart && (
          <Card title="Desktop">
            <Toggle
              label="Launch at login"
              checked={settings.desktop.autostart}
              onChange={async (autostart) => {
                await platform.autostart?.set(autostart);
                await updateSettings({ desktop: { ...settings.desktop, autostart } });
              }}
            />
            <Toggle
              label="Keep running in the tray when the window is closed"
              checked={settings.desktop.closeToTray}
              onChange={(closeToTray) =>
                updateSettings({ desktop: { ...settings.desktop, closeToTray } })
              }
            />
            <button
              type="button"
              className="mt-2 text-sm text-red-600 hover:underline"
              onClick={() => platform.quit()}
            >
              Quit Desk Wellness
            </button>
          </Card>
        )}
      </div>
    </>
  );
}
