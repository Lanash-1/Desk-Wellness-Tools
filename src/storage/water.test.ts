import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import Dexie from 'dexie';
import { DeskWellnessDB, resetDeviceIdCache, setDb } from './db';
import { addWater, removeWater, sumMl, waterForDay } from './water';

describe('water storage', () => {
  beforeEach(() => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    setDb(new DeskWellnessDB(`water-${Math.random()}`));
    resetDeviceIdCache();
  });

  it('buckets drinks by local day (respecting dayStartHour) and sums them', async () => {
    const opts = { dayStartHour: 4, timeZone: 'UTC' };
    const lateNight = Date.UTC(2026, 9, 28, 2, 30); // 02:30 → still the 27th when the day starts at 04:00
    const morning = Date.UTC(2026, 9, 28, 9, 0);
    await addWater(250, 'manual', opts, lateNight);
    await addWater(500, 'reminder', opts, morning);
    await addWater(150, 'manual', opts, morning + 60_000);

    const day27 = await waterForDay('2026-10-27');
    const day28 = await waterForDay('2026-10-28');
    expect(sumMl(day27)).toBe(250);
    expect(sumMl(day28)).toBe(650);
    // Newest first.
    expect(day28.map((r) => r.amountMl)).toEqual([150, 500]);
  });

  it('removal is a soft delete that hides the row', async () => {
    const opts = { dayStartHour: 0, timeZone: 'UTC' };
    const row = await addWater(300, 'manual', opts, Date.UTC(2026, 9, 27, 12, 0));
    await removeWater(row.id);
    expect(await waterForDay('2026-10-27')).toEqual([]);
  });
});
