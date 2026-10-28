import { create } from 'zustand';
import type { ReminderAction, ReminderKind, SchedulerState, Settings } from '@/core/models';
import { REMINDER_KINDS } from '@/core/models';
import type { PomodoroState } from '@/core/pomodoro/engine';
import {
  INITIAL_SCHEDULER,
  applySettingsChange,
  initialStates,
  onBreakEnded as engineOnBreakEnded,
  pause as enginePause,
  respond as engineRespond,
  resume as engineResume,
  tick as engineTick,
  type ReminderStates,
  type RespondAction,
  type SchedulerEffect,
} from '@/core/scheduler/engine';
import { DEFAULT_SETTINGS } from '@/core/settings/defaults';
import { toDayKey } from '@/core/time/dayKey';
import type { Platform } from '@/platform';
import { getDb } from '@/storage/db';
import { reminderEventsRepo } from '@/storage/repositories';
import { addWater } from '@/storage/water';

export interface ReminderDeps {
  platform: Platform;
  getSettings: () => Settings | undefined;
  getPomodoro: () => PomodoroState;
  getWaterTodayMl: () => number;
}

export interface ActiveReminder {
  notificationId: string;
  kinds: ReminderKind[];
  firedAt: number;
  title: string;
  body: string;
}

interface ReminderStore {
  states: ReminderStates | null;
  scheduler: SchedulerState;
  active: ActiveReminder | null;
  ready: boolean;
  init(deps: ReminderDeps): Promise<void>;
  tick(now: number): void;
  /** Answer one kind, or every kind on the active card. */
  respond(kind: ReminderKind | 'all', action: RespondAction): void;
  pauseFor(ms: number): void;
  pauseUntil(ts: number): void;
  resume(): void;
  onBreakEnded(now: number): void;
  settingsChanged(previous: Settings, next: Settings): void;
}

let deps: ReminderDeps | null = null;
/** id of the still-pending ReminderEvent per kind, so responses can resolve it. */
const pendingEventIds = new Map<ReminderKind, string>();

function settings(): Settings | typeof DEFAULT_SETTINGS {
  return deps?.getSettings() ?? DEFAULT_SETTINGS;
}

function dayKeyOpts() {
  const s = settings();
  return { dayStartHour: s.dayStartHour, timeZone: s.timeZone };
}

async function persist(states: ReminderStates, scheduler: SchedulerState): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.reminderState, db.schedulerState, async () => {
    await db.reminderState.bulkPut(Object.values(states));
    await db.schedulerState.put(scheduler);
  });
}

async function applyEffect(effect: SchedulerEffect, now: number): Promise<void> {
  const platform = deps?.platform;
  const s = settings();
  switch (effect.type) {
    case 'logEvent': {
      const row = await reminderEventsRepo.put({
        kind: effect.kind,
        firedAt: effect.at,
        action: 'pending',
        respondedAt: null,
        dayKey: toDayKey(effect.at, s.dayStartHour, s.timeZone),
      });
      pendingEventIds.set(effect.kind, row.id);
      return;
    }
    case 'resolveEvent': {
      const id = pendingEventIds.get(effect.kind);
      if (!id) return;
      pendingEventIds.delete(effect.kind);
      await reminderEventsRepo.update(id, {
        action: effect.action as ReminderAction,
        respondedAt: effect.at,
      });
      return;
    }
    case 'notify':
      if (!platform) return;
      await platform.notifications.show({
        id: effect.id,
        title: effect.title,
        body: effect.body,
        actions: [
          { id: 'done', label: 'Done' },
          { id: 'snooze', label: `Snooze ${s.snoozeMin} min` },
        ],
      });
      return;
    case 'playSound':
      if (platform && s.sound.enabled) await platform.audio.play(effect.soundId, s.sound.volume);
      return;
  }
  void now;
}

export const useReminderStore = create<ReminderStore>((set, get) => ({
  states: null,
  scheduler: INITIAL_SCHEDULER,
  active: null,
  ready: false,

  async init(d) {
    deps = d;
    const db = getDb();
    const now = Date.now();
    const storedStates = await db.reminderState.toArray();
    const storedScheduler = await db.schedulerState.get('default');
    const existing = Object.fromEntries(
      storedStates.map((r) => [r.kind, r]),
    ) as Partial<ReminderStates>;
    const states = initialStates(settings(), now, existing);
    const scheduler = storedScheduler ?? INITIAL_SCHEDULER;
    set({ states, scheduler, ready: true });
    await persist(states, scheduler);

    d.platform.notifications.onAction((id, action) => {
      const active = get().active;
      if (!active || active.notificationId !== id) return;
      if (action === 'click') {
        void d.platform.window.show();
        return;
      }
      get().respond('all', action);
    });
  },

  tick(now) {
    const { states, scheduler } = get();
    if (!states || !deps) return;
    const result = engineTick({
      states,
      scheduler,
      settings: settings(),
      pomodoro: deps.getPomodoro(),
      waterTodayMl: deps.getWaterTodayMl(),
      now,
    });
    const changed =
      REMINDER_KINDS.some((k) => result.states[k] !== states[k]) ||
      result.scheduler.lastNotificationAt !== scheduler.lastNotificationAt;
    const notify = result.effects.find((e) => e.type === 'notify');
    set({
      states: result.states,
      scheduler: result.scheduler,
      ...(notify
        ? {
            active: {
              notificationId: notify.id,
              kinds: notify.kinds,
              firedAt: now,
              title: notify.title,
              body: notify.body,
            },
          }
        : {}),
    });
    if (changed) void persist(result.states, result.scheduler);
    for (const effect of result.effects) void applyEffect(effect, now);
  },

  respond(target, action) {
    const { states, active } = get();
    if (!states) return;
    const now = Date.now();
    const kinds = target === 'all' ? (active?.kinds ?? []) : [target];
    let next = states;
    for (const kind of kinds) {
      const r = engineRespond(next, kind, action, settings(), now);
      next = r.states;
      for (const effect of r.effects) void applyEffect(effect, now);
      if (kind === 'water' && action === 'done') {
        const amount = settings().waterQuickAddMl[0] ?? 250;
        void addWater(amount, 'reminder', dayKeyOpts(), now);
      }
    }
    const remaining = active ? active.kinds.filter((k) => !kinds.includes(k)) : [];
    set({
      states: next,
      active: active && remaining.length > 0 ? { ...active, kinds: remaining } : null,
    });
    void persist(next, get().scheduler);
    if (active) void deps?.platform.notifications.close(active.notificationId);
  },

  pauseFor(ms) {
    get().pauseUntil(Date.now() + ms);
  },

  pauseUntil(ts) {
    const scheduler = enginePause(get().scheduler, ts);
    set({ scheduler, active: null });
    const { states } = get();
    if (states) void persist(states, scheduler);
  },

  resume() {
    const scheduler = engineResume(get().scheduler);
    set({ scheduler });
    const { states } = get();
    if (states) void persist(states, scheduler);
  },

  onBreakEnded(now) {
    const { states, scheduler } = get();
    if (!states) return;
    const next = engineOnBreakEnded(states, settings(), now);
    set({ states: next });
    void persist(next, scheduler);
  },

  settingsChanged(previous, next) {
    const { states, scheduler } = get();
    if (!states) return;
    const updated = applySettingsChange(states, previous, next, Date.now());
    set({ states: updated });
    void persist(updated, scheduler);
  },
}));

/** Local midnight (respecting dayStartHour) after `now`, for "pause until tomorrow". */
export function nextDayStart(now: number): number {
  const s = settings();
  const todayKey = toDayKey(now, s.dayStartHour, s.timeZone);
  // Step forward in 15-minute increments until the day key changes (handles DST cleanly).
  let t = now;
  for (let i = 0; i < 24 * 4 + 8; i++) {
    t += 15 * 60_000;
    if (toDayKey(t, s.dayStartHour, s.timeZone) !== todayKey) return t;
  }
  return now + 24 * 60 * 60_000;
}

/** Test hook. */
export function _resetReminderStoreForTests(): void {
  deps = null;
  pendingEventIds.clear();
  useReminderStore.setState({
    states: null,
    scheduler: INITIAL_SCHEDULER,
    active: null,
    ready: false,
  });
}
