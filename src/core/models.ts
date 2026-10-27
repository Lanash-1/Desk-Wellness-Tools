/**
 * Domain model for Desk Wellness.
 *
 * Rules:
 *  - All timestamps are epoch milliseconds (UTC). Never do wall-clock arithmetic on them.
 *  - Every persisted, syncable entity extends BaseEntity so a future sync layer can
 *    diff (updatedAt), merge (deviceId) and propagate deletes (deletedAt tombstones).
 *  - `dayKey` ('YYYY-MM-DD' in the device's local calendar) is denormalised at write time
 *    so per-day queries are cheap and stable.
 */

export type ReminderKind = 'water' | 'move' | 'eyes' | 'stretch' | 'posture';

export const REMINDER_KINDS: readonly ReminderKind[] = [
  'water',
  'move',
  'eyes',
  'stretch',
  'posture',
] as const;

export type SessionType = 'focus' | 'shortBreak' | 'longBreak';

export type ReminderAction = 'pending' | 'done' | 'snoozed' | 'dismissed' | 'ignored';

export type DuringFocusPolicy = 'allow' | 'deferToBreak';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface BaseEntity {
  /** UUID v4, generated client-side so ids never collide across devices. */
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Soft-delete tombstone. Rows with a deletedAt are hidden from normal reads. */
  deletedAt: number | null;
  /** Which device wrote the latest version. Used for debugging sync conflicts. */
  deviceId: string;
}

export interface ReminderConfig {
  enabled: boolean;
  intervalMin: number;
  soundId: string;
  duringFocus: DuringFocusPolicy;
}

export interface WorkHours {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday (JS Date convention). */
  days: number[];
  /** 'HH:mm' local time. */
  start: string;
  /** 'HH:mm' local time. May be earlier than start for overnight shifts. */
  end: string;
}

export interface QuietHoursRange {
  start: string;
  end: string;
}

export interface Settings extends BaseEntity {
  pomodoro: {
    focusMin: number;
    shortBreakMin: number;
    longBreakMin: number;
    longBreakEvery: number;
    autoStartBreak: boolean;
    autoStartFocus: boolean;
  };
  reminders: Record<ReminderKind, ReminderConfig>;
  workHours: WorkHours;
  quietHours: QuietHoursRange[];
  sound: { enabled: boolean; volume: number };
  waterGoalMl: number;
  waterQuickAddMl: number[];
  /** Daily goals that drive streaks. */
  goals: { focusSessionsPerDay: number; movesPerDay: number };
  desktop: { closeToTray: boolean; autostart: boolean; showDockIcon: boolean };
  theme: ThemePreference;
  snoozeMin: number;
  /** Minimum seconds between two notifications; reminders inside the gap are coalesced. */
  minNotificationGapSec: number;
  /** Hour (0-23) at which a new "day" starts for stats. 0 = midnight. */
  dayStartHour: number;
  /** IANA time zone override; null = follow the device. */
  timeZone: string | null;
}

export interface Session extends BaseEntity {
  type: SessionType;
  startedAt: number;
  /** Planned end at the time the phase started. */
  endsAt: number;
  endedAt: number | null;
  status: 'running' | 'completed' | 'abandoned';
  dayKey: string;
  /** v2: optional task label. Present now so no migration is needed later. */
  label: string | null;
}

export interface WaterLog extends BaseEntity {
  loggedAt: number;
  amountMl: number;
  source: 'manual' | 'reminder';
  dayKey: string;
}

export interface ReminderEvent extends BaseEntity {
  kind: ReminderKind;
  firedAt: number;
  action: ReminderAction;
  respondedAt: number | null;
  dayKey: string;
}

/** Device-local scheduler state. Never synced. */
export interface ReminderState {
  kind: ReminderKind;
  nextFireAt: number;
  lastFiredAt: number | null;
  snoozeCount: number;
  pausedUntil: number | null;
}

export interface SchedulerState {
  id: 'default';
  pausedUntil: number | null;
  lastTickAt: number | null;
  lastNotificationAt: number | null;
}

export interface MetaEntry {
  key: string;
  value: string;
}

/** Derived per-day aggregate. Computed, never stored (v1). */
export interface DailyStats {
  dayKey: string;
  focusSessions: number;
  focusMinutes: number;
  waterMl: number;
  waterGoalMet: boolean;
  movesDone: number;
  eyeBreaksDone: number;
  stretchesDone: number;
  postureChecks: number;
  remindersOffered: number;
  remindersIgnored: number;
  goalsMet: { focus: boolean; water: boolean; move: boolean };
}
