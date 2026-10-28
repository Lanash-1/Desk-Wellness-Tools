import type { DailyStats, ReminderEvent, Session, WaterLog } from '../models';
import type { SettingsData } from '../settings/defaults';

export interface StatsSource {
  sessions: Session[];
  waterLogs: WaterLog[];
  events: ReminderEvent[];
}

export type StatsSettings = Pick<SettingsData, 'goals' | 'waterGoalMl' | 'workHours'>;

export function emptyDay(dayKey: string): DailyStats {
  return {
    dayKey,
    focusSessions: 0,
    focusMinutes: 0,
    waterMl: 0,
    waterGoalMet: false,
    movesDone: 0,
    eyeBreaksDone: 0,
    stretchesDone: 0,
    postureChecks: 0,
    remindersOffered: 0,
    remindersIgnored: 0,
    goalsMet: { focus: false, water: false, move: false },
  };
}

/** Aggregates one day's rows. Inputs may contain rows from other days; they are filtered. */
export function computeDailyStats(
  dayKey: string,
  source: StatsSource,
  settings: StatsSettings,
): DailyStats {
  const stats = emptyDay(dayKey);

  for (const s of source.sessions) {
    if (s.dayKey !== dayKey || s.type !== 'focus' || s.status !== 'completed') continue;
    stats.focusSessions += 1;
    const end = s.endedAt ?? s.endsAt;
    stats.focusMinutes += Math.max(0, Math.round((end - s.startedAt) / 60_000));
  }

  for (const w of source.waterLogs) {
    if (w.dayKey === dayKey) stats.waterMl += w.amountMl;
  }

  for (const e of source.events) {
    if (e.dayKey !== dayKey) continue;
    stats.remindersOffered += 1;
    if (e.action === 'ignored') stats.remindersIgnored += 1;
    if (e.action !== 'done') continue;
    switch (e.kind) {
      case 'move':
        stats.movesDone += 1;
        break;
      case 'eyes':
        stats.eyeBreaksDone += 1;
        break;
      case 'stretch':
        stats.stretchesDone += 1;
        break;
      case 'posture':
        stats.postureChecks += 1;
        break;
    }
  }

  stats.waterGoalMet = settings.waterGoalMl > 0 && stats.waterMl >= settings.waterGoalMl;
  stats.goalsMet = {
    focus: stats.focusSessions >= Math.max(1, settings.goals.focusSessionsPerDay),
    water: stats.waterGoalMet,
    move: stats.movesDone >= Math.max(1, settings.goals.movesPerDay),
  };
  return stats;
}

/** Stats for every day in `dayKeys`, in order; days without rows are zero-filled. */
export function computeRange(
  dayKeys: string[],
  source: StatsSource,
  settings: StatsSettings,
): DailyStats[] {
  return dayKeys.map((k) => computeDailyStats(k, source, settings));
}
