import type { Settings } from '@/core/models';
import { DEFAULT_SETTINGS, SETTINGS_ID, type SettingsData } from '@/core/settings/defaults';
import { getDb, getDeviceId, type DeskWellnessDB } from './db';

/** Deep-merges stored settings over defaults so new fields get sane values after upgrades. */
export function withDefaults(stored: Partial<SettingsData> | undefined): SettingsData {
  if (!stored) return structuredClone(DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    pomodoro: { ...DEFAULT_SETTINGS.pomodoro, ...stored.pomodoro },
    reminders: Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS.reminders).map(([kind, def]) => [
        kind,
        { ...def, ...stored.reminders?.[kind as keyof typeof stored.reminders] },
      ]),
    ) as SettingsData['reminders'],
    workHours: { ...DEFAULT_SETTINGS.workHours, ...stored.workHours },
    sound: { ...DEFAULT_SETTINGS.sound, ...stored.sound },
    goals: { ...DEFAULT_SETTINGS.goals, ...stored.goals },
    desktop: { ...DEFAULT_SETTINGS.desktop, ...stored.desktop },
  };
}

/** Loads settings, creating the singleton row on first run. */
export async function loadSettings(db: DeskWellnessDB = getDb()): Promise<Settings> {
  const existing = await db.settings.get(SETTINGS_ID);
  if (existing) return { ...existing, ...withDefaults(existing) };
  const now = Date.now();
  const row: Settings = {
    id: SETTINGS_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId: await getDeviceId(db),
    ...structuredClone(DEFAULT_SETTINGS),
  };
  await db.settings.put(row);
  return row;
}

/** Applies a partial update to the settings row. */
export async function updateSettings(
  patch: Partial<SettingsData>,
  db: DeskWellnessDB = getDb(),
): Promise<Settings> {
  const current = await loadSettings(db);
  const next: Settings = {
    ...current,
    ...withDefaults({ ...current, ...patch }),
    updatedAt: Date.now(),
    deviceId: await getDeviceId(db),
  };
  await db.settings.put(next);
  return next;
}
