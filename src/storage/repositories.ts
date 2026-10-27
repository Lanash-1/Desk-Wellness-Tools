import type { ReminderEvent, Session, WaterLog } from '@/core/models';
import { Repo } from './repo';

export const sessionsRepo = new Repo<Session>('sessions');
export const waterLogsRepo = new Repo<WaterLog>('waterLogs');
export const reminderEventsRepo = new Repo<ReminderEvent>('reminderEvents');

export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Startup maintenance: drop tombstones older than 90 days. */
export async function runStorageMaintenance(): Promise<void> {
  await Promise.all([
    sessionsRepo.purgeTombstones(TOMBSTONE_TTL_MS),
    waterLogsRepo.purgeTombstones(TOMBSTONE_TTL_MS),
    reminderEventsRepo.purgeTombstones(TOMBSTONE_TTL_MS),
  ]);
}
