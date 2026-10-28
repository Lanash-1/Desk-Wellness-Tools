import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { DailyStats } from '@/core/models';
import { computeRange } from '@/core/stats/daily';
import { computeStreaks, type Streaks } from '@/core/stats/streaks';
import { addDays, dayKeyRange, toDayKey } from '@/core/time/dayKey';
import { reminderEventsRepo, sessionsRepo, waterLogsRepo } from '@/storage/repositories';
import { useSettings } from './useSettings';
import { useTimerStore } from '@/store/timerStore';

export interface StatsView {
  todayKey: string;
  days: DailyStats[];
  today: DailyStats;
  streaks: Streaks;
  loading: boolean;
}

/** Live per-day stats and streaks for the last `dayCount` days (today included). */
export function useStats(dayCount: number): StatsView {
  const settings = useSettings();
  const minute = useTimerStore((s) => Math.floor(s.now / 60_000));
  const todayKey = toDayKey(
    minute * 60_000,
    settings?.dayStartHour ?? 0,
    settings?.timeZone ?? null,
  );
  // Streaks look further back than the chart so "best" is meaningful.
  const streakFrom = addDays(todayKey, -89);
  const chartFrom = addDays(todayKey, -(dayCount - 1));

  const source = useLiveQuery(async () => {
    // dayKeys are lexically ordered, so a string range on the dayKey index works.
    const inRange = <T extends { dayKey: string }>(rows: T[]) =>
      rows.filter((r) => r.dayKey >= streakFrom && r.dayKey <= todayKey);
    const [sessions, waterLogs, events] = await Promise.all([
      sessionsRepo.listAll(),
      waterLogsRepo.listAll(),
      reminderEventsRepo.listAll(),
    ]);
    return { sessions: inRange(sessions), waterLogs: inRange(waterLogs), events: inRange(events) };
  }, [streakFrom, todayKey]);

  return useMemo(() => {
    const s = settings;
    const src = source ?? { sessions: [], waterLogs: [], events: [] };
    const statsSettings = s ?? {
      goals: { focusSessionsPerDay: 4, movesPerDay: 4 },
      waterGoalMl: 2000,
      workHours: { enabled: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
    };
    const all = computeRange(dayKeyRange(streakFrom, todayKey), src, statsSettings);
    const days = all.filter((d) => d.dayKey >= chartFrom);
    return {
      todayKey,
      days,
      today: all[all.length - 1],
      streaks: computeStreaks(all, statsSettings, todayKey),
      loading: !source || !s,
    };
  }, [settings, source, streakFrom, chartFrom, todayKey]);
}
