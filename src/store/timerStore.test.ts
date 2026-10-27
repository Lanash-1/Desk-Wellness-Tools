import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import Dexie from 'dexie';
import { DeskWellnessDB, resetDeviceIdCache, setDb } from '@/storage/db';
import { loadSettings } from '@/storage/settings';
import { createFakePlatform } from '@/platform/fake';
import { _resetTimerStoreForTests, POMODORO_STATE_KEY, useTimerStore } from './timerStore';

const MIN = 60_000;

async function flush() {
  // Let queued effect promises (Dexie writes, notifications) settle.
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('timerStore', () => {
  let db: DeskWellnessDB;

  beforeEach(async () => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    db = new DeskWellnessDB(`timer-${Math.random()}`);
    setDb(db);
    resetDeviceIdCache();
    _resetTimerStoreForTests();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
  });

  it('records sessions, notifies and plays a sound at phase end, and persists state', async () => {
    const platform = createFakePlatform();
    const settings = await loadSettings(db);
    await useTimerStore.getState().init({ platform, getSettings: () => settings });

    const t0 = Date.now();
    useTimerStore.getState().start('focus');
    await flush();

    let sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      type: 'focus',
      status: 'running',
      startedAt: t0,
      dayKey: '2026-10-27',
    });

    // Heartbeat arrives just after the focus phase ends.
    useTimerStore.getState().tick(t0 + 25 * MIN + 800);
    await flush();

    sessions = (await db.sessions.toArray()).sort((a, b) => a.startedAt - b.startedAt);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({ status: 'completed', endedAt: t0 + 25 * MIN });
    expect(sessions[1]).toMatchObject({ type: 'shortBreak', status: 'running' });

    expect(platform.shown).toHaveLength(1);
    expect(platform.shown[0].title).toBe('Focus session complete');
    expect(platform.played[0]).toMatchObject({ soundId: 'chime' });

    const persisted = await db.meta.get(POMODORO_STATE_KEY);
    expect(JSON.parse(persisted!.value)).toMatchObject({
      status: 'running',
      phase: 'shortBreak',
      completedFocus: 1,
    });
  });

  it('restores a persisted phase on init and completes it if it ended while closed', async () => {
    const platform = createFakePlatform();
    const settings = await loadSettings(db);
    const startedAt = Date.now() - 30 * MIN; // ended 5 minutes ago → within the auto-start window
    await db.meta.put({
      key: POMODORO_STATE_KEY,
      value: JSON.stringify({
        status: 'running',
        phase: 'focus',
        sessionId: 'restored',
        startedAt,
        endsAt: startedAt + 25 * MIN,
        completedFocus: 0,
      }),
    });
    await db.sessions.put({
      id: 'restored',
      type: 'focus',
      startedAt,
      endsAt: startedAt + 25 * MIN,
      endedAt: null,
      status: 'running',
      dayKey: '2026-10-27',
      label: null,
      createdAt: startedAt,
      updatedAt: startedAt,
      deletedAt: null,
      deviceId: 'd',
    });

    await useTimerStore.getState().init({ platform, getSettings: () => settings });
    await flush();

    expect(useTimerStore.getState().state).toMatchObject({
      status: 'running',
      phase: 'shortBreak',
      completedFocus: 1,
    });
    expect((await db.sessions.get('restored'))?.status).toBe('completed');
    expect(platform.shown).toHaveLength(1);
  });

  it('skips a stale auto-start after a long sleep', async () => {
    const platform = createFakePlatform();
    const settings = await loadSettings(db);
    await useTimerStore.getState().init({ platform, getSettings: () => settings });
    const t0 = Date.now();
    useTimerStore.getState().start('focus');
    useTimerStore.getState().tick(t0 + 2 * 60 * MIN); // laptop lid closed for two hours
    await flush();
    expect(useTimerStore.getState().state).toMatchObject({
      status: 'awaitingNext',
      nextPhase: 'shortBreak',
    });
    expect(platform.shown).toHaveLength(1);
  });
});
