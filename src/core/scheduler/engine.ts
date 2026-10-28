/**
 * Reminder scheduler. Pure: `tick()` takes the current reminder states plus everything it
 * needs to decide (settings, pomodoro state, today's water, now) and returns new states and
 * a list of effects for the runtime to apply. All times are epoch ms.
 *
 * Gates, in order, for each enabled kind that is due:
 *   1. stale-drop   – overdue by more than STALE_MS (machine slept): reschedule, fire nothing
 *   2. global pause – deferred to shortly after the pause ends
 *   3. work hours   – outside: deferred to the next work window start + interval
 *   4. quiet hours  – inside: deferred to shortly after the range ends
 *   5. pomodoro     – during focus, kinds with `deferToBreak` wait for the break; during a
 *                     break, kinds that became due at the break start fire (the break is the
 *                     moment to move), everything else waits for the break to end
 *   6. water goal   – once today's goal is met the water reminder stays quiet
 * Whatever survives is coalesced into one notification; a minimum gap between notifications
 * defers anything that would arrive too soon after the previous one.
 */

import type {
  ReminderAction,
  ReminderKind,
  ReminderState,
  SchedulerState,
  WorkHours,
} from '../models';
import { REMINDER_KINDS } from '../models';
import type { PomodoroState } from '../pomodoro/engine';
import { REMINDER_LABELS, type SettingsData } from '../settings/defaults';
import { isWithinRange, parseHHmm, toLocalMinutes, toWeekday } from '../time/dayKey';

export type ReminderStates = Record<ReminderKind, ReminderState>;

export type SchedulerSettings = Pick<
  SettingsData,
  | 'reminders'
  | 'workHours'
  | 'quietHours'
  | 'snoozeMin'
  | 'minNotificationGapSec'
  | 'waterGoalMl'
  | 'timeZone'
  | 'dayStartHour'
>;

export interface SchedulerInput {
  states: ReminderStates;
  scheduler: SchedulerState;
  settings: SchedulerSettings;
  pomodoro: PomodoroState;
  waterTodayMl: number;
  now: number;
}

export type SchedulerEffect =
  | { type: 'notify'; id: string; kinds: ReminderKind[]; title: string; body: string }
  | { type: 'playSound'; soundId: string }
  | { type: 'logEvent'; kind: ReminderKind; at: number }
  | {
      type: 'resolveEvent';
      kind: ReminderKind;
      action: Exclude<ReminderAction, 'pending'>;
      at: number;
    };

export interface SchedulerResult {
  states: ReminderStates;
  scheduler: SchedulerState;
  effects: SchedulerEffect[];
}

export type RespondAction = 'done' | 'snooze' | 'dismiss';

const MIN = 60_000;
const DAY_MIN = 24 * 60;

/** Overdue by more than this → the machine was asleep; reschedule silently. */
export const STALE_MS = 10 * MIN;
/** How soon after a pause / quiet range ends reminders may resume. */
export const RESUME_GRACE_MS = 1 * MIN;
/** Deferral when the minimum-gap rule blocks a notification. */
export const GAP_DEFER_MS = 2 * MIN;
/** After this many snoozes in a row the next snooze counts as a dismiss. */
export const MAX_SNOOZES = 3;

/** Which kind headlines a coalesced notification. */
const PRIORITY: ReminderKind[] = ['move', 'eyes', 'water', 'posture', 'stretch'];

/** Kinds whose timers restart when a Pomodoro break ends (the break covered them). */
const BREAK_COVERS: ReminderKind[] = ['move', 'eyes', 'stretch', 'posture'];

export const INITIAL_SCHEDULER: SchedulerState = {
  id: 'default',
  pausedUntil: null,
  lastTickAt: null,
  lastNotificationAt: null,
};

export function intervalMs(kind: ReminderKind, settings: SchedulerSettings): number {
  return Math.max(1, settings.reminders[kind].intervalMin) * MIN;
}

export function freshState(
  kind: ReminderKind,
  settings: SchedulerSettings,
  now: number,
): ReminderState {
  return {
    kind,
    nextFireAt: now + intervalMs(kind, settings),
    lastFiredAt: null,
    snoozeCount: 0,
    pausedUntil: null,
  };
}

/** Builds a full state map, keeping any existing entries. */
export function initialStates(
  settings: SchedulerSettings,
  now: number,
  existing: Partial<ReminderStates> = {},
): ReminderStates {
  const out = {} as ReminderStates;
  for (const kind of REMINDER_KINDS) out[kind] = existing[kind] ?? freshState(kind, settings, now);
  return out;
}

/**
 * Timestamp of the next work-window start strictly after `now`, or null when work hours are
 * disabled or no day is selected. Computed in local minutes; a DST change inside the gap can
 * shift the result by an hour, which is acceptable for reminders.
 */
export function nextWorkWindowStart(
  now: number,
  workHours: WorkHours,
  timeZone: string | null,
): number | null {
  if (!workHours.enabled || workHours.days.length === 0) return null;
  const nowMin = toLocalMinutes(now, timeZone);
  const startMin = parseHHmm(workHours.start);
  const weekday = toWeekday(now, 0, timeZone);
  for (let offset = 0; offset <= 7; offset++) {
    const day = (weekday + offset) % 7;
    if (!workHours.days.includes(day)) continue;
    if (offset === 0 && nowMin >= startMin) continue;
    return now + (offset * DAY_MIN + startMin - nowMin) * MIN;
  }
  return null;
}

export function isWorkTime(now: number, workHours: WorkHours, timeZone: string | null): boolean {
  if (!workHours.enabled) return true;
  const nowMin = toLocalMinutes(now, timeZone);
  const startMin = parseHHmm(workHours.start);
  const endMin = parseHHmm(workHours.end);
  const weekday = toWeekday(now, 0, timeZone);
  if (startMin < endMin)
    return workHours.days.includes(weekday) && nowMin >= startMin && nowMin < endMin;
  // Overnight shift: the part after midnight belongs to the previous day's shift.
  if (nowMin >= startMin) return workHours.days.includes(weekday);
  return nowMin < endMin && workHours.days.includes((weekday + 6) % 7);
}

/** End timestamp of the quiet range containing `now`, or null when none does. */
export function quietRangeEnd(now: number, settings: SchedulerSettings): number | null {
  const nowMin = toLocalMinutes(now, settings.timeZone);
  for (const range of settings.quietHours) {
    if (isWithinRange(nowMin, range.start, range.end)) {
      const endMin = parseHHmm(range.end);
      const delta = (endMin - nowMin + DAY_MIN) % DAY_MIN || DAY_MIN;
      return now + delta * MIN;
    }
  }
  return null;
}

function label(kind: ReminderKind): string {
  return REMINDER_LABELS[kind].title;
}

/** Title/body for a (possibly coalesced) set of kinds, headline chosen by priority. */
export function describe(kinds: ReminderKind[]): {
  head: ReminderKind;
  title: string;
  body: string;
} {
  const ordered = PRIORITY.filter((k) => kinds.includes(k));
  const head = ordered[0] ?? kinds[0];
  const rest = ordered.slice(1);
  if (rest.length === 0) return { head, title: label(head), body: REMINDER_LABELS[head].body };
  const restText = rest.map((k) => label(k).toLowerCase()).join(', ');
  return {
    head,
    title: `${label(head)} · +${rest.length} more`,
    body: `${REMINDER_LABELS[head].body} Also: ${restText}.`,
  };
}

export function tick(input: SchedulerInput): SchedulerResult {
  const { settings, pomodoro, now, waterTodayMl } = input;
  const states: ReminderStates = { ...input.states };
  const scheduler: SchedulerState = { ...input.scheduler, lastTickAt: now };
  const effects: SchedulerEffect[] = [];
  const due: ReminderKind[] = [];

  const paused = scheduler.pausedUntil !== null && now < scheduler.pausedUntil;
  const workTime = isWorkTime(now, settings.workHours, settings.timeZone);
  const quietEnd = quietRangeEnd(now, settings);
  const inFocus = pomodoro.status === 'running' && pomodoro.phase === 'focus';
  const inBreak = pomodoro.status === 'running' && pomodoro.phase !== 'focus';

  for (const kind of REMINDER_KINDS) {
    const cfg = settings.reminders[kind];
    if (!cfg.enabled) continue;
    const st = states[kind];
    if (now < st.nextFireAt) continue;
    const interval = intervalMs(kind, settings);
    const defer = (to: number) => {
      states[kind] = { ...st, nextFireAt: Math.max(to, now + 1000) };
    };

    if (now - st.nextFireAt > STALE_MS) {
      defer(now + interval);
      continue;
    }
    if (paused) {
      defer(scheduler.pausedUntil! + RESUME_GRACE_MS);
      continue;
    }
    if (!workTime) {
      const next = nextWorkWindowStart(now, settings.workHours, settings.timeZone);
      defer(next === null ? now + interval : next + interval);
      continue;
    }
    if (quietEnd !== null) {
      defer(quietEnd + RESUME_GRACE_MS);
      continue;
    }
    if (inFocus && cfg.duringFocus === 'deferToBreak') {
      defer(pomodoro.endsAt);
      continue;
    }
    if (inBreak && kind !== 'water' && st.nextFireAt > pomodoro.startedAt) {
      // Became due mid-break: the break already covers it; wait for the break to end.
      defer(pomodoro.endsAt + 1000);
      continue;
    }
    if (kind === 'water' && waterTodayMl >= settings.waterGoalMl) {
      defer(now + interval);
      continue;
    }
    due.push(kind);
  }

  if (due.length > 0) {
    const gapMs = settings.minNotificationGapSec * 1000;
    if (scheduler.lastNotificationAt !== null && now - scheduler.lastNotificationAt < gapMs) {
      for (const kind of due) states[kind] = { ...states[kind], nextFireAt: now + GAP_DEFER_MS };
    } else {
      for (const kind of due) {
        const st = states[kind];
        if (st.lastFiredAt !== null)
          effects.push({ type: 'resolveEvent', kind, action: 'ignored', at: now });
        effects.push({ type: 'logEvent', kind, at: now });
        states[kind] = { ...st, lastFiredAt: now, nextFireAt: now + intervalMs(kind, settings) };
      }
      const { head, title, body } = describe(due);
      effects.push({ type: 'notify', id: `reminder:${now}`, kinds: due, title, body });
      effects.push({ type: 'playSound', soundId: settings.reminders[head].soundId });
      scheduler.lastNotificationAt = now;
    }
  }

  return { states, scheduler, effects };
}

/** Applies the user's answer to the most recent fire of `kind`. */
export function respond(
  states: ReminderStates,
  kind: ReminderKind,
  action: RespondAction,
  settings: SchedulerSettings,
  now: number,
): { states: ReminderStates; effects: SchedulerEffect[] } {
  const st = states[kind];
  let effective: RespondAction = action;
  if (action === 'snooze' && st.snoozeCount >= MAX_SNOOZES) effective = 'dismiss';

  const next: ReminderState =
    effective === 'snooze'
      ? {
          ...st,
          nextFireAt: now + Math.max(1, settings.snoozeMin) * MIN,
          snoozeCount: st.snoozeCount + 1,
        }
      : { ...st, nextFireAt: now + intervalMs(kind, settings), snoozeCount: 0 };

  const recorded: Exclude<ReminderAction, 'pending'> =
    effective === 'done' ? 'done' : effective === 'snooze' ? 'snoozed' : 'dismissed';

  return {
    states: { ...states, [kind]: next },
    effects: [{ type: 'resolveEvent', kind, action: recorded, at: now }],
  };
}

export function pause(scheduler: SchedulerState, until: number): SchedulerState {
  return { ...scheduler, pausedUntil: until };
}

export function resume(scheduler: SchedulerState): SchedulerState {
  return { ...scheduler, pausedUntil: null };
}

/** A Pomodoro break just ended: the user moved, so restart the break-covered timers. */
export function onBreakEnded(
  states: ReminderStates,
  settings: SchedulerSettings,
  now: number,
): ReminderStates {
  const out = { ...states };
  for (const kind of BREAK_COVERS) {
    out[kind] = { ...out[kind], nextFireAt: now + intervalMs(kind, settings), snoozeCount: 0 };
  }
  return out;
}

/** Settings changed: re-anchor kinds whose interval changed, enable newly enabled ones. */
export function applySettingsChange(
  states: ReminderStates,
  previous: SchedulerSettings,
  next: SchedulerSettings,
  now: number,
): ReminderStates {
  const out = { ...states };
  for (const kind of REMINDER_KINDS) {
    const before = previous.reminders[kind];
    const after = next.reminders[kind];
    if (after.intervalMin !== before.intervalMin || (after.enabled && !before.enabled)) {
      out[kind] = { ...out[kind], nextFireAt: now + intervalMs(kind, next), snoozeCount: 0 };
    }
  }
  return out;
}

/** The soonest enabled reminder, for "next reminder in …" displays. */
export function nextDue(
  states: ReminderStates,
  settings: SchedulerSettings,
): { kind: ReminderKind; at: number } | null {
  let best: { kind: ReminderKind; at: number } | null = null;
  for (const kind of REMINDER_KINDS) {
    if (!settings.reminders[kind].enabled) continue;
    const at = states[kind].nextFireAt;
    if (!best || at < best.at) best = { kind, at };
  }
  return best;
}
