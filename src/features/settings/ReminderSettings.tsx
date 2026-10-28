import { Card } from '@/components/Card';
import { NumberField } from '@/components/NumberField';
import { Toggle } from '@/components/Toggle';
import {
  REMINDER_KINDS,
  type DuringFocusPolicy,
  type ReminderKind,
  type Settings,
} from '@/core/models';
import { REMINDER_LABELS } from '@/core/settings/defaults';
import { updateSettings } from '@/storage/settings';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ReminderSettings({ settings }: { settings: Settings }) {
  const setKind = (kind: ReminderKind, patch: Partial<Settings['reminders'][ReminderKind]>) =>
    updateSettings({
      reminders: { ...settings.reminders, [kind]: { ...settings.reminders[kind], ...patch } },
    });

  return (
    <>
      <Card title="Reminders">
        {REMINDER_KINDS.map((kind) => {
          const cfg = settings.reminders[kind];
          return (
            <div
              key={kind}
              className="border-b border-slate-100 py-1 last:border-b-0 dark:border-slate-800"
            >
              <Toggle
                label={REMINDER_LABELS[kind].title}
                description={REMINDER_LABELS[kind].body}
                checked={cfg.enabled}
                onChange={(enabled) => setKind(kind, { enabled })}
              />
              {cfg.enabled && (
                <div className="grid gap-x-6 pb-2 pl-1 sm:grid-cols-2">
                  <NumberField
                    label="Every"
                    value={cfg.intervalMin}
                    min={5}
                    max={240}
                    step={5}
                    suffix="min"
                    onChange={(intervalMin) => setKind(kind, { intervalMin })}
                  />
                  <label className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="font-medium">During focus</span>
                    <select
                      className="rounded-lg border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
                      value={cfg.duringFocus}
                      onChange={(e) =>
                        setKind(kind, { duringFocus: e.target.value as DuringFocusPolicy })
                      }
                    >
                      <option value="deferToBreak">Wait for the break</option>
                      <option value="allow">Interrupt</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          );
        })}
        <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
          <NumberField
            label="Snooze length"
            value={settings.snoozeMin}
            min={1}
            max={30}
            suffix="min"
            onChange={(snoozeMin) => updateSettings({ snoozeMin })}
          />
          <NumberField
            label="Min. gap between notifications"
            value={settings.minNotificationGapSec}
            min={0}
            max={600}
            step={30}
            suffix="sec"
            onChange={(minNotificationGapSec) => updateSettings({ minNotificationGapSec })}
          />
        </div>
      </Card>

      <Card title="Work hours">
        <Toggle
          label="Only remind me during work hours"
          checked={settings.workHours.enabled}
          onChange={(enabled) => updateSettings({ workHours: { ...settings.workHours, enabled } })}
        />
        {settings.workHours.enabled && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Work days">
              {DAYS.map((name, day) => {
                const on = settings.workHours.days.includes(day);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      updateSettings({
                        workHours: {
                          ...settings.workHours,
                          days: on
                            ? settings.workHours.days.filter((d) => d !== day)
                            : [...settings.workHours.days, day].sort(),
                        },
                      })
                    }
                    className={`rounded-full px-3 py-1 text-sm ${
                      on
                        ? 'bg-brand-600 text-white'
                        : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-x-6 sm:grid-cols-2">
              <TimeField
                label="Start"
                value={settings.workHours.start}
                onChange={(start) =>
                  updateSettings({ workHours: { ...settings.workHours, start } })
                }
              />
              <TimeField
                label="End"
                value={settings.workHours.end}
                onChange={(end) => updateSettings({ workHours: { ...settings.workHours, end } })}
              />
            </div>
          </div>
        )}
      </Card>

      <Card title="Quiet hours">
        <Toggle
          label="Silence reminders during a daily window"
          description="For lunch, a standing meeting, or the evening."
          checked={settings.quietHours.length > 0}
          onChange={(on) =>
            updateSettings({ quietHours: on ? [{ start: '12:30', end: '13:30' }] : [] })
          }
        />
        {settings.quietHours[0] && (
          <div className="grid gap-x-6 pt-2 sm:grid-cols-2">
            <TimeField
              label="From"
              value={settings.quietHours[0].start}
              onChange={(start) =>
                updateSettings({ quietHours: [{ ...settings.quietHours[0], start }] })
              }
            />
            <TimeField
              label="Until"
              value={settings.quietHours[0].end}
              onChange={(end) =>
                updateSettings({ quietHours: [{ ...settings.quietHours[0], end }] })
              }
            />
          </div>
        )}
      </Card>
    </>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-transparent px-2 py-1 tabular-nums dark:border-slate-700"
      />
    </label>
  );
}
