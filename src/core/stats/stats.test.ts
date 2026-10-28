import { describe, expect, it } from 'vitest';
import type { ReminderEvent, Session, WaterLog } from '../models';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { dayKeyRange } from '../time/dayKey';
import { computeDailyStats, computeRange, emptyDay } from './daily';
import { computeStreaks } from './streaks';

const base = { id: 'x', createdAt: 0, updatedAt: 0, deletedAt: null, deviceId: 'd' };
const MIN = 60_000;

function session(
  dayKey: string,
  minutes: number,
  status: Session['status'] = 'completed',
  type: Session['type'] = 'focus',
): Session {
  const startedAt = Date.UTC(2026, 9, 27, 9, 0);
  return {
    ...base,
    id: Math.random().toString(),
    type,
    startedAt,
    endsAt: startedAt + minutes * MIN,
    endedAt: startedAt + minutes * MIN,
    status,
    dayKey,
    label: null,
  };
}
function water(dayKey: string, ml: number): WaterLog {
  return {
    ...base,
    id: Math.random().toString(),
    loggedAt: 0,
    amountMl: ml,
    source: 'manual',
    dayKey,
  };
}
function event(
  dayKey: string,
  kind: ReminderEvent['kind'],
  action: ReminderEvent['action'],
): ReminderEvent {
  return {
    ...base,
    id: Math.random().toString(),
    kind,
    firedAt: 0,
    action,
    respondedAt: null,
    dayKey,
  };
}

describe('computeDailyStats', () => {
  it('aggregates completed focus, water, and answered reminders for the day only', () => {
    const day = '2026-10-27';
    const stats = computeDailyStats(
      day,
      {
        sessions: [
          session(day, 25),
          session(day, 25),
          session(day, 10, 'abandoned'),
          session(day, 5, 'completed', 'shortBreak'),
          session('2026-10-26', 25),
        ],
        waterLogs: [water(day, 500), water(day, 1500), water('2026-10-26', 999)],
        events: [
          event(day, 'move', 'done'),
          event(day, 'move', 'ignored'),
          event(day, 'eyes', 'done'),
          event(day, 'stretch', 'snoozed'),
          event(day, 'posture', 'done'),
          event('2026-10-26', 'move', 'done'),
        ],
      },
      DEFAULT_SETTINGS,
    );
    expect(stats).toMatchObject({
      focusSessions: 2,
      focusMinutes: 50,
      waterMl: 2000,
      waterGoalMet: true,
      movesDone: 1,
      eyeBreaksDone: 1,
      stretchesDone: 0,
      postureChecks: 1,
      remindersOffered: 5,
      remindersIgnored: 1,
      goalsMet: { focus: false, water: true, move: false },
    });
  });

  it('zero-fills days without data', () => {
    const range = computeRange(
      dayKeyRange('2026-10-25', '2026-10-27'),
      { sessions: [], waterLogs: [], events: [] },
      DEFAULT_SETTINGS,
    );
    expect(range).toHaveLength(3);
    expect(range[0]).toEqual(emptyDay('2026-10-25'));
  });
});

describe('computeStreaks', () => {
  const settings = { ...DEFAULT_SETTINGS, goals: { focusSessionsPerDay: 1, movesPerDay: 1 } };
  const met = (dayKey: string, focus = true, waterOk = true, move = true) => ({
    ...emptyDay(dayKey),
    goalsMet: { focus, water: waterOk, move },
  });

  it('skips weekends and keeps today in progress', () => {
    // Thu 22 → Tue 27. Weekend (24, 25) has no data; today (Tue 27) not yet met.
    const days = [
      met('2026-10-22'),
      met('2026-10-23'),
      emptyDay('2026-10-24'),
      emptyDay('2026-10-25'),
      met('2026-10-26'),
      emptyDay('2026-10-27'),
    ];
    const s = computeStreaks(days, settings, '2026-10-27');
    expect(s.focus.current).toBe(3);
    expect(s.wellness.current).toBe(3);
    expect(s.focus.best).toBe(3);
  });

  it('counts today when met and breaks on a missed working day', () => {
    const days = [met('2026-10-22'), emptyDay('2026-10-23'), met('2026-10-26'), met('2026-10-27')];
    const s = computeStreaks(days, settings, '2026-10-27');
    expect(s.focus.current).toBe(2);
    expect(s.focus.best).toBe(2);
  });

  it('tracks metrics independently and remembers the best run', () => {
    const days = [
      met('2026-10-19', true, false),
      met('2026-10-20', true, false),
      met('2026-10-21', true, false),
      emptyDay('2026-10-22'),
      met('2026-10-23', true, true),
    ];
    const s = computeStreaks(days, settings, '2026-10-23');
    expect(s.focus).toEqual({ current: 1, best: 3 });
    expect(s.water).toEqual({ current: 1, best: 1 });
    expect(s.wellness).toEqual({ current: 1, best: 1 });
  });

  it('treats every day as a working day when work hours are disabled', () => {
    const noHours = { ...settings, workHours: { ...settings.workHours, enabled: false } };
    const days = [
      met('2026-10-23'),
      emptyDay('2026-10-24'),
      emptyDay('2026-10-25'),
      met('2026-10-26'),
    ];
    expect(computeStreaks(days, noHours, '2026-10-26').focus.current).toBe(1);
    expect(computeStreaks(days, settings, '2026-10-26').focus.current).toBe(2);
  });
});
