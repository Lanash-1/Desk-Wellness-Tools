import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { ProgressRing } from '@/components/ProgressRing';
import { useSettings } from '@/app/useSettings';
import { useWaterToday } from '@/app/useWaterToday';
import { addWater, removeWater } from '@/storage/water';
import { updateSettings } from '@/storage/settings';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function WaterPage() {
  const settings = useSettings();
  const { rows, totalMl } = useWaterToday();
  const [custom, setCustom] = useState('');
  const goal = settings?.waterGoalMl ?? 2000;
  const progress = goal > 0 ? totalMl / goal : 0;
  const opts = { dayStartHour: settings?.dayStartHour ?? 0, timeZone: settings?.timeZone ?? null };

  const add = (ml: number) => {
    if (ml > 0) void addWater(ml, 'manual', opts);
  };

  return (
    <>
      <PageHeader
        title="Water"
        subtitle="Track your intake and get a nudge when it's been a while."
      />
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center gap-4">
          <ProgressRing progress={progress} size={200} label="Water goal progress">
            <div className="text-center">
              <p className="text-3xl font-semibold tabular-nums" data-testid="water-total">
                {totalMl}
              </p>
              <p className="text-sm text-slate-500">of {goal} ml</p>
            </div>
          </ProgressRing>
          {totalMl >= goal && goal > 0 ? (
            <p className="text-sm font-medium text-brand-700 dark:text-brand-100">
              Goal reached. Reminders are quiet for today.
            </p>
          ) : (
            <p className="text-sm text-slate-500">{Math.max(0, goal - totalMl)} ml to go</p>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Add a drink">
            <div className="flex flex-wrap gap-2">
              {(settings?.waterQuickAddMl ?? [150, 250, 500]).map((ml) => (
                <Button key={ml} variant="secondary" onClick={() => add(ml)}>
                  +{ml} ml
                </Button>
              ))}
            </div>
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add(Number(custom));
                setCustom('');
              }}
            >
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={5000}
                placeholder="Custom amount"
                aria-label="Custom amount in millilitres"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="w-40 rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm dark:border-slate-700"
              />
              <span className="text-sm text-slate-500">ml</span>
              <Button type="submit" disabled={!custom || Number(custom) <= 0}>
                Add
              </Button>
            </form>
          </Card>

          <Card title="Daily goal">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>Target per day</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={250}
                  max={6000}
                  step={50}
                  value={goal}
                  aria-label="Daily water goal in millilitres"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (n >= 250 && n <= 6000) void updateSettings({ waterGoalMl: n });
                  }}
                  className="w-24 rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-right tabular-nums dark:border-slate-700"
                />
                <span className="text-slate-500">ml</span>
              </span>
            </label>
          </Card>

          <Card title="Today">
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing logged yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-medium tabular-nums">{row.amountMl} ml</span>
                      <span className="ml-2 text-slate-500">
                        {formatTime(row.loggedAt)}
                        {row.source === 'reminder' ? ' · from reminder' : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="text-xs text-slate-500 hover:text-red-600"
                      aria-label={`Remove ${row.amountMl} ml logged at ${formatTime(row.loggedAt)}`}
                      onClick={() => void removeWater(row.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
