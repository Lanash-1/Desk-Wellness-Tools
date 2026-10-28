import type { DailyStats } from '../models';
import { dayKeyWeekday } from '../time/dayKey';
import type { StatsSettings } from './daily';

export type StreakMetric = 'focus' | 'water' | 'move' | 'wellness';

export interface Streak {
  current: number;
  best: number;
}

export type Streaks = Record<StreakMetric, Streak>;

function metricMet(day: DailyStats, metric: StreakMetric): boolean {
  switch (metric) {
    case 'focus':
      return day.goalsMet.focus;
    case 'water':
      return day.goalsMet.water;
    case 'move':
      return day.goalsMet.move;
    case 'wellness':
      return day.goalsMet.focus && day.goalsMet.water && day.goalsMet.move;
  }
}

/**
 * Streaks over `days` (ascending, contiguous, ending at `todayKey`).
 *
 * Rules:
 *  - a day counts when the metric's goal was met;
 *  - today counts if met but does not break the streak while it is still in progress;
 *  - non-working days (per work-hours settings) are skipped, not broken, so a Monday
 *    streak is not reset by the weekend;
 *  - `best` is the longest run inside the window.
 */
export function computeStreaks(
  days: DailyStats[],
  settings: StatsSettings,
  todayKey: string,
): Streaks {
  const workDays = settings.workHours.enabled ? settings.workHours.days : [0, 1, 2, 3, 4, 5, 6];
  const isWorkDay = (dayKey: string) => workDays.includes(dayKeyWeekday(dayKey));

  const metrics: StreakMetric[] = ['focus', 'water', 'move', 'wellness'];
  const out = {} as Streaks;

  for (const metric of metrics) {
    // Current: walk back from today.
    let current = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const day = days[i];
      if (day.dayKey > todayKey) continue;
      if (!isWorkDay(day.dayKey)) continue;
      const met = metricMet(day, metric);
      if (met) current += 1;
      else if (day.dayKey === todayKey)
        continue; // still in progress
      else break;
    }

    // Best: longest run forward, skipping non-working days and an unfinished today.
    let best = 0;
    let run = 0;
    for (const day of days) {
      if (day.dayKey > todayKey || !isWorkDay(day.dayKey)) continue;
      if (metricMet(day, metric)) {
        run += 1;
        best = Math.max(best, run);
      } else if (day.dayKey !== todayKey) {
        run = 0;
      }
    }
    out[metric] = { current, best: Math.max(best, current) };
  }
  return out;
}
