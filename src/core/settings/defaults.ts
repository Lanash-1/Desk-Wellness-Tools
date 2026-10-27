import type { ReminderConfig, ReminderKind, Settings } from '../models';

export const SETTINGS_ID = 'default';

/** The "Balanced" preset: ~3 notifications in a normal working hour. */
export const DEFAULT_REMINDERS: Record<ReminderKind, ReminderConfig> = {
  water: { enabled: true, intervalMin: 45, soundId: 'drop', duringFocus: 'allow' },
  move: { enabled: true, intervalMin: 60, soundId: 'chime', duringFocus: 'deferToBreak' },
  eyes: { enabled: true, intervalMin: 20, soundId: 'soft', duringFocus: 'deferToBreak' },
  stretch: { enabled: true, intervalMin: 90, soundId: 'chime', duringFocus: 'deferToBreak' },
  posture: { enabled: true, intervalMin: 30, soundId: 'soft', duringFocus: 'deferToBreak' },
};

export type SettingsData = Omit<Settings, keyof import('../models').BaseEntity>;

export const DEFAULT_SETTINGS: SettingsData = {
  pomodoro: {
    focusMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
    longBreakEvery: 4,
    autoStartBreak: true,
    autoStartFocus: false,
  },
  reminders: DEFAULT_REMINDERS,
  workHours: { enabled: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
  quietHours: [],
  sound: { enabled: true, volume: 0.6 },
  waterGoalMl: 2000,
  waterQuickAddMl: [150, 250, 500],
  goals: { focusSessionsPerDay: 4, movesPerDay: 4 },
  desktop: { closeToTray: true, autostart: false, showDockIcon: true },
  theme: 'system',
  snoozeMin: 5,
  minNotificationGapSec: 90,
  dayStartHour: 0,
  timeZone: null,
};

export const REMINDER_LABELS: Record<ReminderKind, { title: string; body: string }> = {
  water: { title: 'Time for some water', body: 'A few sips now keeps the afternoon slump away.' },
  move: { title: 'Stand up and move', body: 'Walk around for a couple of minutes.' },
  eyes: { title: 'Rest your eyes', body: 'Look at something 20 feet away for 20 seconds.' },
  stretch: { title: 'Quick stretch', body: 'Neck, shoulders, wrists – 60 seconds is enough.' },
  posture: { title: 'Posture check', body: 'Shoulders back, feet flat, screen at eye level.' },
};
