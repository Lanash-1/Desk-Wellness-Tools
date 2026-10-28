import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { useSettings } from '@/app/useSettings';
import { useStats } from '@/app/useStats';
import type { Streaks } from '@/core/stats/streaks';

// Validated with the dataviz palette checker for both light and dark surfaces.
const TEAL = '#0d9488';
const AMBER = '#d97706';
const GRID = 'rgba(100, 116, 139, 0.2)';
const INK = 'rgb(100 116 139)';

function shortDay(dayKey: string, range: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return range <= 7
    ? date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid rgba(100,116,139,0.3)',
    background: 'var(--tooltip-bg, white)',
    color: 'inherit',
    fontSize: 12,
  },
  cursor: { fill: GRID },
};

export function StatsPage() {
  const [range, setRange] = useState<7 | 30>(7);
  const settings = useSettings();
  const { days, streaks, loading } = useStats(range);

  const data = days.map((d) => ({
    day: shortDay(d.dayKey, range),
    focusMinutes: d.focusMinutes,
    waterMl: d.waterMl,
    offered: d.remindersOffered,
    done: d.movesDone + d.eyeBreaksDone + d.stretchesDone + d.postureChecks,
  }));
  const totalIgnored = days.reduce((a, d) => a + d.remindersIgnored, 0);
  const totalOffered = days.reduce((a, d) => a + d.remindersOffered, 0);
  const tick = { fontSize: 11, fill: INK };

  return (
    <>
      <PageHeader
        title="Stats"
        subtitle="Focus, hydration and breaks over the last weeks."
        action={
          <div
            role="group"
            aria-label="Range"
            className="flex rounded-full border border-slate-300 p-0.5 text-sm dark:border-slate-700"
          >
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={`rounded-full px-3 py-1 ${range === r ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
              >
                {r} days
              </button>
            ))}
          </div>
        }
      />

      <StreakTiles streaks={streaks} />

      <div className="mt-4 space-y-4">
        <Card title="Focus minutes per day">
          <div className="h-56" data-testid="chart-focus">
            <ResponsiveContainer>
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                barCategoryGap="30%"
              >
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="day"
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                  interval={range > 7 ? 4 : 0}
                />
                <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v} min`, 'Focus']} />
                <Bar
                  dataKey="focusMinutes"
                  name="Focus"
                  fill={TEAL}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!loading}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Water per day">
          <div className="h-56" data-testid="chart-water">
            <ResponsiveContainer>
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                barCategoryGap="30%"
              >
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="day"
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                  interval={range > 7 ? 4 : 0}
                />
                <YAxis tick={tick} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v} ml`, 'Water']} />
                <ReferenceLine
                  y={settings?.waterGoalMl ?? 2000}
                  stroke={INK}
                  strokeDasharray="4 4"
                  label={{ value: 'goal', position: 'insideTopRight', fontSize: 11, fill: INK }}
                />
                <Bar
                  dataKey="waterMl"
                  name="Water"
                  fill={TEAL}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!loading}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Breaks: offered vs taken">
          <div className="h-56" data-testid="chart-breaks">
            <ResponsiveContainer>
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                barCategoryGap="30%"
                barGap={2}
              >
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="day"
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                  interval={range > 7 ? 4 : 0}
                />
                <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="offered"
                  name="Offered"
                  fill={AMBER}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!loading}
                />
                <Bar
                  dataKey="done"
                  name="Taken"
                  fill={TEAL}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!loading}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {totalOffered === 0
              ? 'No reminders yet in this range.'
              : totalIgnored === 0
                ? `You answered every one of ${totalOffered} reminders. Nice.`
                : `${totalIgnored} of ${totalOffered} reminders went unanswered.`}
          </p>
        </Card>
      </div>
    </>
  );
}

const STREAK_LABEL: Record<keyof Streaks, string> = {
  wellness: 'Wellness streak',
  focus: 'Focus goal',
  water: 'Water goal',
  move: 'Movement goal',
};

export function StreakTiles({ streaks, compact = false }: { streaks: Streaks; compact?: boolean }) {
  const order: (keyof Streaks)[] = ['wellness', 'focus', 'water', 'move'];
  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
      {order.map((key) => (
        <Card key={key} className={compact ? 'p-3' : ''}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {STREAK_LABEL[key]}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums" data-testid={`streak-${key}`}>
            {streaks[key].current}
            <span className="ml-1 text-sm font-normal text-slate-500">
              {streaks[key].current === 1 ? 'day' : 'days'}
            </span>
          </p>
          <p className="text-xs text-slate-500">Best {streaks[key].best}</p>
        </Card>
      ))}
    </div>
  );
}
