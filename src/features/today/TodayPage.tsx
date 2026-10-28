import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { usePlatform } from '@/app/usePlatform';
import { useSettings } from '@/app/useSettings';
import { REMINDER_KINDS } from '@/core/models';
import { REMINDER_LABELS } from '@/core/settings/defaults';
import { NotificationBanner } from '@/features/notifications/NotificationBanner';
import { useTimerStore } from '@/store/timerStore';
import { useReminderStore } from '@/store/reminderStore';
import { useWaterToday } from '@/app/useWaterToday';
import { addWater } from '@/storage/water';
import { Button } from '@/components/Button';
import { isWorkTime } from '@/core/scheduler/engine';

export function TodayPage() {
  const settings = useSettings();
  const platform = usePlatform();
  const completedFocus = useTimerStore((s) => s.state.completedFocus);
  const now = useTimerStore((s) => s.now);
  const { totalMl } = useWaterToday();
  const states = useReminderStore((s) => s.states);
  const pausedUntil = useReminderStore((s) => s.scheduler.pausedUntil);
  const paused = pausedUntil !== null && pausedUntil > now;
  const offHours = settings ? !isWorkTime(now, settings.workHours, settings.timeZone) : false;

  const describeNext = (kind: (typeof REMINDER_KINDS)[number]): string => {
    const cfg = settings?.reminders[kind];
    if (!cfg) return '…';
    if (!cfg.enabled) return 'off';
    if (paused) return 'paused';
    if (offHours) return 'after work hours';
    const at = states?.[kind].nextFireAt;
    if (!at) return `every ${cfg.intervalMin} min`;
    const mins = Math.max(0, Math.round((at - now) / 60_000));
    return mins === 0 ? 'any moment' : `in ${mins} min`;
  };

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
      <NotificationBanner />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Focus">
          <p className="text-3xl font-semibold">
            {completedFocus} {completedFocus === 1 ? 'session' : 'sessions'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Goal: {settings?.goals.focusSessionsPerDay ?? '…'} per day
          </p>
        </Card>
        <Card title="Water">
          <p className="text-3xl font-semibold tabular-nums" data-testid="today-water">
            {totalMl} ml
          </p>
          <p className="mt-1 text-sm text-slate-500">Goal: {settings?.waterGoalMl ?? '…'} ml</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(settings?.waterQuickAddMl ?? []).map((ml) => (
              <Button
                key={ml}
                variant="secondary"
                className="px-3 py-1 text-xs"
                onClick={() =>
                  void addWater(ml, 'manual', {
                    dayStartHour: settings?.dayStartHour ?? 0,
                    timeZone: settings?.timeZone ?? null,
                  })
                }
              >
                +{ml} ml
              </Button>
            ))}
          </div>
        </Card>
        <Card title="Reminders" className="sm:col-span-2">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {REMINDER_KINDS.map((kind) => {
              return (
                <li key={kind} className="flex items-center justify-between py-2 text-sm">
                  <span>{REMINDER_LABELS[kind].title}</span>
                  <span className="text-slate-500" data-testid={`next-${kind}`}>
                    {describeNext(kind)}
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
