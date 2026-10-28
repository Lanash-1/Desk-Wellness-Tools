import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import type { PomodoroState } from '../pomodoro/engine';
import {
  GAP_DEFER_MS,
  INITIAL_SCHEDULER,
  MAX_SNOOZES,
  RESUME_GRACE_MS,
  STALE_MS,
  applySettingsChange,
  describe as describeKinds,
  initialStates,
  isWorkTime,
  nextDue,
  nextWorkWindowStart,
  onBreakEnded,
  pause,
  respond,
  tick,
  type SchedulerInput,
  type SchedulerSettings,
} from './engine';

const MIN = 60_000;
const TZ = 'UTC';
// Tuesday 2026-10-27 10:00 UTC – inside the default 09:00–18:00 Mon–Fri window.
const T0 = Date.UTC(2026, 9, 27, 10, 0);
const IDLE: PomodoroState = { status: 'idle', completedFocus: 0 };

function settings(overrides: Partial<SchedulerSettings> = {}): SchedulerSettings {
  return { ...structuredClone(DEFAULT_SETTINGS), timeZone: TZ, ...overrides };
}

function input(
  partial: Partial<SchedulerInput> & { now: number; settings?: SchedulerSettings },
): SchedulerInput {
  const s = partial.settings ?? settings();
  return {
    states: partial.states ?? initialStates(s, T0),
    scheduler: partial.scheduler ?? INITIAL_SCHEDULER,
    settings: s,
    pomodoro: partial.pomodoro ?? IDLE,
    waterTodayMl: partial.waterTodayMl ?? 0,
    now: partial.now,
  };
}

const notifies = (r: ReturnType<typeof tick>) => r.effects.filter((e) => e.type === 'notify');

describe('scheduling basics', () => {
  it('fires a kind at its interval and reschedules from the fire time', () => {
    const r = tick(input({ now: T0 + 20 * MIN }));
    expect(notifies(r)).toHaveLength(1);
    expect(notifies(r)[0]).toMatchObject({ kinds: ['eyes'], title: 'Rest your eyes' });
    expect(r.effects).toContainEqual({ type: 'logEvent', kind: 'eyes', at: T0 + 20 * MIN });
    expect(r.effects).toContainEqual({ type: 'playSound', soundId: 'soft' });
    expect(r.states.eyes.nextFireAt).toBe(T0 + 40 * MIN);
    expect(r.states.eyes.lastFiredAt).toBe(T0 + 20 * MIN);
    expect(r.scheduler.lastNotificationAt).toBe(T0 + 20 * MIN);
  });

  it('does nothing when nothing is due', () => {
    const r = tick(input({ now: T0 + 5 * MIN }));
    expect(r.effects).toEqual([]);
  });

  it('ignores disabled kinds', () => {
    const s = settings();
    s.reminders.eyes.enabled = false;
    const r = tick(input({ now: T0 + 20 * MIN, settings: s }));
    expect(r.effects).toEqual([]);
  });

  it('coalesces kinds due in the same tick into one notification, headline by priority', () => {
    // Four kinds come due within the same minute (each within the stale window).
    const states = initialStates(settings(), T0);
    for (const kind of ['eyes', 'posture', 'water'] as const)
      states[kind].nextFireAt = T0 + 60 * MIN - 30_000;
    const r = tick(input({ now: T0 + 60 * MIN, states }));
    const n = notifies(r);
    expect(n).toHaveLength(1);
    expect(n[0].kinds.sort()).toEqual(['eyes', 'move', 'posture', 'water']);
    expect(n[0].title).toBe('Stand up and move · +3 more');
    expect(r.effects.filter((e) => e.type === 'logEvent')).toHaveLength(4);
  });

  it('marks the previous unanswered fire as ignored when firing again', () => {
    const first = tick(input({ now: T0 + 20 * MIN }));
    const second = tick(
      input({ now: T0 + 40 * MIN, states: first.states, scheduler: first.scheduler }),
    );
    expect(second.effects).toContainEqual({
      type: 'resolveEvent',
      kind: 'eyes',
      action: 'ignored',
      at: T0 + 40 * MIN,
    });
  });

  it('defers a notification that would arrive inside the minimum gap', () => {
    const first = tick(input({ now: T0 + 20 * MIN })); // eyes
    // Posture due at +30 but artificially bring it to +20.5 min: within the 90 s gap.
    const states = {
      ...first.states,
      posture: { ...first.states.posture, nextFireAt: T0 + 20 * MIN + 30_000 },
    };
    const r = tick(input({ now: T0 + 20 * MIN + 30_000, states, scheduler: first.scheduler }));
    expect(notifies(r)).toHaveLength(0);
    expect(r.states.posture.nextFireAt).toBe(T0 + 20 * MIN + 30_000 + GAP_DEFER_MS);
  });

  it('drops stale fires after a sleep gap instead of bursting', () => {
    const r = tick(input({ now: T0 + 3 * 60 * MIN })); // three hours later
    expect(notifies(r)).toHaveLength(0);
    expect(r.states.eyes.nextFireAt).toBe(T0 + 3 * 60 * MIN + 20 * MIN);
    expect(r.states.move.nextFireAt).toBe(T0 + 3 * 60 * MIN + 60 * MIN);
  });

  it('fires when overdue by less than the stale threshold', () => {
    const r = tick(input({ now: T0 + 20 * MIN + STALE_MS - 1 }));
    expect(notifies(r)).toHaveLength(1);
  });
});

describe('gates', () => {
  it('pause defers everything to shortly after the pause ends', () => {
    const until = T0 + 60 * MIN;
    const r = tick(input({ now: T0 + 20 * MIN, scheduler: pause(INITIAL_SCHEDULER, until) }));
    expect(r.effects).toEqual([]);
    expect(r.states.eyes.nextFireAt).toBe(until + RESUME_GRACE_MS);
  });

  it('outside work hours defers to the next window start plus the interval', () => {
    const evening = Date.UTC(2026, 9, 27, 19, 0); // Tue 19:00
    const states = initialStates(settings(), evening - 30 * MIN);
    const r = tick(input({ now: evening, states }));
    expect(r.effects).toEqual([]);
    const wedStart = Date.UTC(2026, 9, 28, 9, 0);
    expect(r.states.eyes.nextFireAt).toBe(wedStart + 20 * MIN);
  });

  it('skips the weekend when computing the next work window', () => {
    const fridayNight = Date.UTC(2026, 9, 30, 20, 0);
    expect(nextWorkWindowStart(fridayNight, settings().workHours, TZ)).toBe(
      Date.UTC(2026, 10, 2, 9, 0),
    );
    expect(isWorkTime(Date.UTC(2026, 9, 31, 12, 0), settings().workHours, TZ)).toBe(false); // Saturday
    expect(isWorkTime(Date.UTC(2026, 9, 27, 12, 0), settings().workHours, TZ)).toBe(true);
  });

  it('handles overnight work hours', () => {
    const wh = { enabled: true, days: [1, 2, 3, 4, 5], start: '22:00', end: '06:00' };
    expect(isWorkTime(Date.UTC(2026, 9, 27, 23, 0), wh, TZ)).toBe(true); // Tue 23:00
    expect(isWorkTime(Date.UTC(2026, 9, 28, 3, 0), wh, TZ)).toBe(true); // Wed 03:00 (Tue shift)
    expect(isWorkTime(Date.UTC(2026, 9, 31, 3, 0), wh, TZ)).toBe(true); // Sat 03:00 (Fri shift)
    expect(isWorkTime(Date.UTC(2026, 10, 1, 3, 0), wh, TZ)).toBe(false); // Sun 03:00 (Sat shift)
  });

  it('quiet hours spanning midnight defer to the range end', () => {
    const s = settings({ quietHours: [{ start: '09:30', end: '11:00' }] });
    const r = tick(input({ now: T0 + 20 * MIN, settings: s })); // 10:20
    expect(r.effects).toEqual([]);
    expect(r.states.eyes.nextFireAt).toBe(Date.UTC(2026, 9, 27, 11, 0) + RESUME_GRACE_MS);

    const night = settings({
      quietHours: [{ start: '22:00', end: '06:00' }],
      workHours: { ...DEFAULT_SETTINGS.workHours, enabled: false },
    });
    const at = Date.UTC(2026, 9, 27, 23, 30);
    const r2 = tick(
      input({ now: at, settings: night, states: initialStates(night, at - 20 * MIN) }),
    );
    expect(r2.states.eyes.nextFireAt).toBe(Date.UTC(2026, 9, 28, 6, 0) + RESUME_GRACE_MS);
  });

  it('defers deferToBreak kinds to the end of a focus phase but lets water through', () => {
    const focus: PomodoroState = {
      status: 'running',
      phase: 'focus',
      sessionId: 's',
      startedAt: T0,
      endsAt: T0 + 25 * MIN,
      completedFocus: 0,
    };
    const states = initialStates(settings(), T0);
    states.water.nextFireAt = T0 + 20 * MIN;
    const r = tick(input({ now: T0 + 20 * MIN, pomodoro: focus, states }));
    expect(notifies(r)[0].kinds).toEqual(['water']);
    expect(r.states.eyes.nextFireAt).toBe(T0 + 25 * MIN);
  });

  it('fires deferred kinds at break start, waits for the break end otherwise', () => {
    const brk: PomodoroState = {
      status: 'running',
      phase: 'shortBreak',
      sessionId: 's',
      startedAt: T0 + 25 * MIN + 200,
      endsAt: T0 + 30 * MIN,
      completedFocus: 1,
    };
    const states = initialStates(settings(), T0);
    states.eyes.nextFireAt = T0 + 25 * MIN; // deferred to focus end earlier
    states.posture.nextFireAt = T0 + 27 * MIN; // becomes due mid-break
    const atStart = tick(input({ now: T0 + 25 * MIN + 500, pomodoro: brk, states }));
    expect(notifies(atStart)[0].kinds).toEqual(['eyes']);
    const mid = tick(
      input({
        now: T0 + 27 * MIN,
        pomodoro: brk,
        states: atStart.states,
        scheduler: atStart.scheduler,
      }),
    );
    expect(notifies(mid)).toHaveLength(0);
    expect(mid.states.posture.nextFireAt).toBe(brk.endsAt + 1000);
  });

  it('keeps water quiet once the daily goal is met', () => {
    const r = tick(input({ now: T0 + 45 * MIN, waterTodayMl: 2000 }));
    expect(notifies(r)[0]?.kinds ?? []).not.toContain('water');
    expect(r.states.water.nextFireAt).toBe(T0 + 90 * MIN);
  });
});

describe('responses and resets', () => {
  it('done reschedules a full interval; snooze is short and capped', () => {
    const s = settings();
    const states = initialStates(s, T0);
    const done = respond(states, 'move', 'done', s, T0 + 61 * MIN);
    expect(done.states.move.nextFireAt).toBe(T0 + 121 * MIN);
    expect(done.effects).toEqual([
      { type: 'resolveEvent', kind: 'move', action: 'done', at: T0 + 61 * MIN },
    ]);

    let cur = states;
    for (let i = 0; i < MAX_SNOOZES; i++) {
      const r = respond(cur, 'move', 'snooze', s, T0);
      expect(r.states.move.nextFireAt).toBe(T0 + 5 * MIN);
      expect(r.effects[0]).toMatchObject({ action: 'snoozed' });
      cur = r.states;
    }
    const capped = respond(cur, 'move', 'snooze', s, T0);
    expect(capped.effects[0]).toMatchObject({ action: 'dismissed' });
    expect(capped.states.move.nextFireAt).toBe(T0 + 60 * MIN);
    expect(capped.states.move.snoozeCount).toBe(0);
  });

  it('a finished break restarts the break-covered timers', () => {
    const s = settings();
    const states = initialStates(s, T0);
    const out = onBreakEnded(states, s, T0 + 30 * MIN);
    expect(out.move.nextFireAt).toBe(T0 + 90 * MIN);
    expect(out.eyes.nextFireAt).toBe(T0 + 50 * MIN);
    expect(out.water.nextFireAt).toBe(T0 + 45 * MIN); // untouched
  });

  it('re-anchors kinds whose interval changed or were just enabled', () => {
    const before = settings();
    before.reminders.posture.enabled = false;
    const after = settings();
    after.reminders.eyes.intervalMin = 30;
    const states = initialStates(before, T0);
    const out = applySettingsChange(states, before, after, T0 + 5 * MIN);
    expect(out.eyes.nextFireAt).toBe(T0 + 35 * MIN);
    expect(out.posture.nextFireAt).toBe(T0 + 35 * MIN);
    expect(out.move.nextFireAt).toBe(T0 + 60 * MIN);
  });

  it('reports the next due reminder and describes coalesced sets', () => {
    const s = settings();
    expect(nextDue(initialStates(s, T0), s)).toEqual({ kind: 'eyes', at: T0 + 20 * MIN });
    expect(describeKinds(['stretch', 'water']).title).toBe('Time for some water · +1 more');
    expect(describeKinds(['posture']).body).toBe(
      DEFAULT_SETTINGS.reminders.posture ? 'Shoulders back, feet flat, screen at eye level.' : '',
    );
  });
});
