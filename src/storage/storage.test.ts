import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import Dexie from 'dexie';
import type { Session, WaterLog } from '@/core/models';
import { DEFAULT_SETTINGS } from '@/core/settings/defaults';
import { DeskWellnessDB, resetDeviceIdCache, setDb } from './db';
import { Repo } from './repo';
import { loadSettings, updateSettings, withDefaults } from './settings';

let db: DeskWellnessDB;

beforeEach(() => {
  // Fresh IndexedDB per test.
  Dexie.dependencies.indexedDB = new IDBFactory();
  db = new DeskWellnessDB(`test-${Math.random()}`);
  setDb(db);
  resetDeviceIdCache();
});

describe('Repo', () => {
  it('stamps audit fields on put and preserves createdAt on update', async () => {
    let clock = 1_000;
    const repo = new Repo<WaterLog>(
      'waterLogs',
      () => db,
      () => clock,
    );
    const row = await repo.put({
      loggedAt: 1_000,
      amountMl: 250,
      source: 'manual',
      dayKey: '2026-10-27',
    });
    expect(row.id).toMatch(/[0-9a-f-]{36}/);
    expect(row.createdAt).toBe(1_000);
    expect(row.updatedAt).toBe(1_000);
    expect(row.deletedAt).toBeNull();
    expect(row.deviceId).toBeTruthy();

    clock = 2_000;
    const updated = await repo.update(row.id, { amountMl: 300 });
    expect(updated?.amountMl).toBe(300);
    expect(updated?.createdAt).toBe(1_000);
    expect(updated?.updatedAt).toBe(2_000);
  });

  it('soft-deletes and hides tombstones from reads', async () => {
    const repo = new Repo<WaterLog>('waterLogs', () => db);
    const a = await repo.put({
      loggedAt: 10,
      amountMl: 100,
      source: 'manual',
      dayKey: '2026-10-27',
    });
    await repo.put({ loggedAt: 20, amountMl: 200, source: 'manual', dayKey: '2026-10-27' });
    await repo.softDelete(a.id);

    expect(await repo.get(a.id)).toBeUndefined();
    expect((await repo.listByDay('2026-10-27')).map((r) => r.amountMl)).toEqual([200]);
    expect((await repo.listRange('loggedAt', 0, 100)).length).toBe(1);
    // ...but sync sees the tombstone.
    const changes = await repo.changesSince(0);
    expect(changes.find((r) => r.id === a.id)?.deletedAt).not.toBeNull();
  });

  it('applies remote rows with last-writer-wins', async () => {
    const repo = new Repo<Session>('sessions', () => db);
    const local = await repo.put({
      type: 'focus',
      startedAt: 1,
      endsAt: 2,
      endedAt: null,
      status: 'running',
      dayKey: '2026-10-27',
      label: null,
    });
    const older: Session = { ...local, label: 'stale', updatedAt: local.updatedAt - 1 };
    const newer: Session = { ...local, label: 'fresh', updatedAt: local.updatedAt + 1 };
    await repo.applyRemote([older]);
    expect((await repo.get(local.id))?.label).toBeNull();
    await repo.applyRemote([newer]);
    expect((await repo.get(local.id))?.label).toBe('fresh');
  });

  it('purges old tombstones only', async () => {
    let clock = 0;
    const repo = new Repo<WaterLog>(
      'waterLogs',
      () => db,
      () => clock,
    );
    const old = await repo.put({ loggedAt: 1, amountMl: 1, source: 'manual', dayKey: 'd' });
    await repo.softDelete(old.id);
    clock = 50;
    const recent = await repo.put({ loggedAt: 2, amountMl: 2, source: 'manual', dayKey: 'd' });
    await repo.softDelete(recent.id);
    clock = 100;
    expect(await repo.purgeTombstones(60)).toBe(1);
    expect(await db.waterLogs.count()).toBe(1);
  });
});

describe('settings', () => {
  it('creates defaults on first load and persists updates', async () => {
    const first = await loadSettings(db);
    expect(first.waterGoalMl).toBe(DEFAULT_SETTINGS.waterGoalMl);
    expect(first.reminders.eyes.intervalMin).toBe(20);

    await updateSettings({ waterGoalMl: 2500 }, db);
    const second = await loadSettings(db);
    expect(second.waterGoalMl).toBe(2500);
    expect(second.createdAt).toBe(first.createdAt);
  });

  it('fills new fields from defaults for rows written by older versions', () => {
    const merged = withDefaults({
      waterGoalMl: 1800,
      reminders: { water: { intervalMin: 30 } },
    } as never);
    expect(merged.waterGoalMl).toBe(1800);
    expect(merged.reminders.water.intervalMin).toBe(30);
    expect(merged.reminders.water.enabled).toBe(true);
    expect(merged.reminders.move.intervalMin).toBe(60);
    expect(merged.pomodoro.focusMin).toBe(25);
  });
});
