import type { ReminderEvent, Session, Settings, WaterLog } from '@/core/models';
import { getDb, type DeskWellnessDB } from './db';
import { reminderEventsRepo, sessionsRepo, waterLogsRepo } from './repositories';
import { loadSettings, withDefaults } from './settings';

export const BACKUP_SCHEMA_VERSION = 1;

export interface Backup {
  app: 'desk-wellness';
  schemaVersion: number;
  exportedAt: number;
  settings: Settings;
  sessions: Session[];
  waterLogs: WaterLog[];
  reminderEvents: ReminderEvent[];
}

export async function exportBackup(db: DeskWellnessDB = getDb()): Promise<Backup> {
  const [settings, sessions, waterLogs, reminderEvents] = await Promise.all([
    loadSettings(db),
    db.sessions.toArray(),
    db.waterLogs.toArray(),
    db.reminderEvents.toArray(),
  ]);
  return {
    app: 'desk-wellness',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: Date.now(),
    settings,
    sessions,
    waterLogs,
    reminderEvents,
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFileName(exportedAt: number): string {
  const d = new Date(exportedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `desk-wellness-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export class BackupError extends Error {}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('That file is not valid JSON.');
  }
  const b = data as Partial<Backup>;
  if (!b || b.app !== 'desk-wellness' || typeof b.schemaVersion !== 'number') {
    throw new BackupError('That file is not a Desk Wellness backup.');
  }
  if (b.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app.');
  }
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    app: 'desk-wellness',
    schemaVersion: b.schemaVersion,
    exportedAt: typeof b.exportedAt === 'number' ? b.exportedAt : Date.now(),
    settings: b.settings as Settings,
    sessions: arr<Session>(b.sessions),
    waterLogs: arr<WaterLog>(b.waterLogs),
    reminderEvents: arr<ReminderEvent>(b.reminderEvents),
  };
}

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  sessions: number;
  waterLogs: number;
  reminderEvents: number;
  settingsApplied: boolean;
}

/**
 * Imports a backup. `merge` keeps local rows and applies remote ones last-writer-wins;
 * `replace` wipes synced tables first. Device-local scheduler state is never touched.
 */
export async function importBackup(
  backup: Backup,
  mode: ImportMode,
  db: DeskWellnessDB = getDb(),
): Promise<ImportSummary> {
  if (mode === 'replace') {
    await db.transaction('rw', db.sessions, db.waterLogs, db.reminderEvents, async () => {
      await Promise.all([db.sessions.clear(), db.waterLogs.clear(), db.reminderEvents.clear()]);
    });
  }
  await sessionsRepo.applyRemote(backup.sessions);
  await waterLogsRepo.applyRemote(backup.waterLogs);
  await reminderEventsRepo.applyRemote(backup.reminderEvents);

  let settingsApplied = false;
  if (backup.settings && typeof backup.settings === 'object') {
    const current = await loadSettings(db);
    if (mode === 'replace' || backup.settings.updatedAt > current.updatedAt) {
      await db.settings.put({
        ...current,
        ...withDefaults(backup.settings),
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: Date.now(),
        deletedAt: null,
      });
      settingsApplied = true;
    }
  }
  return {
    sessions: backup.sessions.length,
    waterLogs: backup.waterLogs.length,
    reminderEvents: backup.reminderEvents.length,
    settingsApplied,
  };
}

/** Deletes every table, including device-local state. Settings are recreated on next load. */
export async function clearAllData(db: DeskWellnessDB = getDb()): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.settings,
      db.sessions,
      db.waterLogs,
      db.reminderEvents,
      db.reminderState,
      db.schedulerState,
      db.meta,
    ],
    async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
    },
  );
}
