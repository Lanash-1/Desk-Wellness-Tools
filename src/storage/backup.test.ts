import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import Dexie from 'dexie';
import { DeskWellnessDB, resetDeviceIdCache, setDb } from './db';
import { addWater } from './water';
import { sessionsRepo } from './repositories';
import { loadSettings, updateSettings } from './settings';
import { clearAllData, exportBackup, importBackup, parseBackup, serializeBackup } from './backup';

describe('backup', () => {
  let db: DeskWellnessDB;
  beforeEach(() => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    db = new DeskWellnessDB(`backup-${Math.random()}`);
    setDb(db);
    resetDeviceIdCache();
  });

  it('round-trips through JSON into a wiped database', async () => {
    await updateSettings({ waterGoalMl: 2750 }, db);
    await addWater(
      300,
      'manual',
      { dayStartHour: 0, timeZone: 'UTC' },
      Date.UTC(2026, 9, 27, 10, 0),
    );
    await sessionsRepo.put({
      type: 'focus',
      startedAt: 1,
      endsAt: 2,
      endedAt: 2,
      status: 'completed',
      dayKey: '2026-10-27',
      label: null,
    });

    const text = serializeBackup(await exportBackup(db));
    await clearAllData(db);
    expect(await db.waterLogs.count()).toBe(0);

    const summary = await importBackup(parseBackup(text), 'replace', db);
    expect(summary).toEqual({
      sessions: 1,
      waterLogs: 1,
      reminderEvents: 0,
      settingsApplied: true,
    });
    expect((await loadSettings(db)).waterGoalMl).toBe(2750);
    expect(await db.waterLogs.count()).toBe(1);
    expect(await db.sessions.count()).toBe(1);
  });

  it('merge keeps local rows and prefers newer settings only', async () => {
    const opts = { dayStartHour: 0, timeZone: 'UTC' };
    await addWater(100, 'manual', opts, 1_000);
    const backup = await exportBackup(db);
    await addWater(200, 'manual', opts, 2_000);
    // Local settings are newer than the backup's.
    await updateSettings({ waterGoalMl: 1800 }, db);

    const summary = await importBackup(backup, 'merge', db);
    expect(summary.settingsApplied).toBe(false);
    expect(await db.waterLogs.count()).toBe(2);
    expect((await loadSettings(db)).waterGoalMl).toBe(1800);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope')).toThrow(/valid JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/not a Desk Wellness backup/);
    expect(() => parseBackup('{"app":"desk-wellness","schemaVersion":99}')).toThrow(
      /newer version/,
    );
  });
});
