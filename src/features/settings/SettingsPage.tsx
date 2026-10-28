import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { Toggle } from '@/components/Toggle';
import { NumberField } from '@/components/NumberField';
import { ReminderSettings } from './ReminderSettings';
import { usePlatform } from '@/app/usePlatform';
import { useSettings } from '@/app/useSettings';
import type { ThemePreference } from '@/core/models';
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

        <Card title="Focus timer">
          <NumberField
            label="Focus length"
            value={settings.pomodoro.focusMin}
            min={1}
            max={120}
            suffix="min"
            onChange={(focusMin) =>
              updateSettings({ pomodoro: { ...settings.pomodoro, focusMin } })
            }
          />
          <NumberField
            label="Short break"
            value={settings.pomodoro.shortBreakMin}
            min={1}
            max={60}
            suffix="min"
            onChange={(shortBreakMin) =>
              updateSettings({ pomodoro: { ...settings.pomodoro, shortBreakMin } })
            }
          />
          <NumberField
            label="Long break"
            value={settings.pomodoro.longBreakMin}
            min={1}
            max={90}
            suffix="min"
            onChange={(longBreakMin) =>
              updateSettings({ pomodoro: { ...settings.pomodoro, longBreakMin } })
            }
          />
          <NumberField
            label="Long break after"
            value={settings.pomodoro.longBreakEvery}
            min={1}
            max={12}
            suffix="sessions"
            onChange={(longBreakEvery) =>
              updateSettings({ pomodoro: { ...settings.pomodoro, longBreakEvery } })
            }
          />
          <Toggle
            label="Start breaks automatically"
            checked={settings.pomodoro.autoStartBreak}
            onChange={(autoStartBreak) =>
              updateSettings({ pomodoro: { ...settings.pomodoro, autoStartBreak } })
            }
          />
          <Toggle
            label="Start the next focus session automatically"
            checked={settings.pomodoro.autoStartFocus}
            onChange={(autoStartFocus) =>
              updateSettings({ pomodoro: { ...settings.pomodoro, autoStartFocus } })
            }
          />
        </Card>

        <ReminderSettings settings={settings} />

        <Card title="Water">
          <NumberField
            label="Daily goal"
            value={settings.waterGoalMl}
            min={250}
            max={6000}
            step={50}
            suffix="ml"
            onChange={(waterGoalMl) => updateSettings({ waterGoalMl })}
          />
          <label className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="font-medium">Quick-add amounts</span>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Quick-add amounts in millilitres, comma separated"
              defaultValue={settings.waterQuickAddMl.join(', ')}
              onBlur={(e) => {
                const values = e.target.value
                  .split(/[,\s]+/)
                  .map(Number)
                  .filter((n) => Number.isFinite(n) && n > 0 && n <= 5000)
                  .slice(0, 5);
                if (values.length > 0) void updateSettings({ waterQuickAddMl: values });
              }}
              className="w-40 rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-right dark:border-slate-700"
            />
          </label>
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
