import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { usePlatform } from '@/app/usePlatform';
import { useSettings } from '@/app/useSettings';
import { REMINDER_KINDS } from '@/core/models';
import { REMINDER_LABELS } from '@/core/settings/defaults';

export function TodayPage() {
  const settings = useSettings();
  const platform = usePlatform();

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={
          platform.kind === 'tauri'
            ? 'Running in the tray. Reminders keep going while this window is hidden.'
            : 'Keep this tab open (or install the app) so reminders can reach you.'
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Focus">
          <p className="text-3xl font-semibold">0 sessions</p>
          <p className="mt-1 text-sm text-slate-500">
            Goal: {settings?.goals.focusSessionsPerDay ?? '…'} per day
          </p>
        </Card>
        <Card title="Water">
          <p className="text-3xl font-semibold">0 ml</p>
          <p className="mt-1 text-sm text-slate-500">Goal: {settings?.waterGoalMl ?? '…'} ml</p>
        </Card>
        <Card title="Reminders" className="sm:col-span-2">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {REMINDER_KINDS.map((kind) => {
              const cfg = settings?.reminders[kind];
              return (
                <li key={kind} className="flex items-center justify-between py-2 text-sm">
                  <span>{REMINDER_LABELS[kind].title}</span>
                  <span className="text-slate-500">
                    {cfg ? (cfg.enabled ? `every ${cfg.intervalMin} min` : 'off') : '…'}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
