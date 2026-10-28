import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import Dexie from 'dexie';
import { DeskWellnessDB, resetDeviceIdCache, setDb } from '@/storage/db';
import { loadSettings } from '@/storage/settings';
import { createFakePlatform } from '@/platform/fake';
import type { PomodoroState } from '@/core/pomodoro/engine';
import { _resetReminderStoreForTests, useReminderStore } from './reminderStore';

const MIN = 60_000;
const IDLE: PomodoroState = { status: 'idle', completedFocus: 0 };

async function flush() {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('reminderStore', () => {
  let db: DeskWellnessDB;

  beforeEach(async () => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    db = new DeskWellnessDB(`rem-${Math.random()}`);
    setDb(db);
    resetDeviceIdCache();
    _resetReminderStoreForTests();
    vi.useFakeTimers({ toFake: ['Date'] });
    // Tuesday 10:00 UTC, inside default work hours.
    vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
  });

  it('fires, shows the card, logs the event and resolves it on Done', async () => {
    const platform = createFakePlatform();
    const settings = { ...(await loadSettings(db)), timeZone: 'UTC' };
    const store = useReminderStore.getState();
    await store.init({
      platform,
      getSettings: () => settings,
      getPomodoro: () => IDLE,
      getWaterTodayMl: () => 0,
    });
    const t0 = Date.now();

    useReminderStore.getState().tick(t0 + 20 * MIN + 500);
    await flush();

    const { active } = useReminderStore.getState();
    expect(active?.kinds).toEqual(['eyes']);
    expect(platform.shown).toHaveLength(1);
    expect(platform.shown[0].title).toBe('Rest your eyes');
    expect(platform.played[0]?.soundId).toBe('soft');
    let events = await db.reminderEvents.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'eyes', action: 'pending', dayKey: '2026-10-27' });

    vi.setSystemTime(t0 + 21 * MIN);
    useReminderStore.getState().respond('all', 'done');
    await flush();

    expect(useReminderStore.getState().active).toBeNull();
    events = await db.reminderEvents.toArray();
    expect(events[0]).toMatchObject({ action: 'done', respondedAt: t0 + 21 * MIN });
    expect(useReminderStore.getState().states?.eyes.nextFireAt).toBe(t0 + 41 * MIN);
    // Persisted for restart recovery.
    expect((await db.reminderState.get('eyes'))?.nextFireAt).toBe(t0 + 41 * MIN);
  });

  it('water Done logs a drink, pause silences, and state is restored on init', async () => {
    const platform = createFakePlatform();
    const settings = { ...(await loadSettings(db)), timeZone: 'UTC' };
    await useReminderStore.getState().init({
      platform,
      getSettings: () => settings,
      getPomodoro: () => IDLE,
      getWaterTodayMl: () => 0,
    });
    const t0 = Date.now();

    useReminderStore.getState().tick(t0 + 45 * MIN + 100);
    await flush();
    // 20-min eyes and 30-min posture are stale-dropped by now; only water fires.
    expect(useReminderStore.getState().active?.kinds).toEqual(['water']);
    useReminderStore.getState().respond('water', 'done');
    await flush();
    const logs = await db.waterLogs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ amountMl: 150, source: 'reminder' });

    vi.setSystemTime(t0 + 45 * MIN + 100);
    useReminderStore.getState().pauseFor(60 * MIN);
    useReminderStore.getState().tick(t0 + 60 * MIN);
    await flush();
    expect(useReminderStore.getState().active).toBeNull();
    expect(platform.shown).toHaveLength(1);

    // Fresh store instance picks up the persisted schedule.
    _resetReminderStoreForTests();
    await useReminderStore.getState().init({
      platform,
      getSettings: () => settings,
      getPomodoro: () => IDLE,
      getWaterTodayMl: () => 0,
    });
    expect(useReminderStore.getState().scheduler.pausedUntil).toBe(t0 + 45 * MIN + 100 + 60 * MIN);
    expect(useReminderStore.getState().states?.water.nextFireAt).toBeGreaterThan(t0 + 60 * MIN);
  });
});
