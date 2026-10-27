import Dexie, { type EntityTable } from 'dexie';
import type {
  BaseEntity,
  MetaEntry,
  ReminderEvent,
  ReminderState,
  SchedulerState,
  Session,
  Settings,
  WaterLog,
} from '@/core/models';

export const DB_NAME = 'deskwellness';

export class DeskWellnessDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  waterLogs!: EntityTable<WaterLog, 'id'>;
  reminderEvents!: EntityTable<ReminderEvent, 'id'>;
  // Device-local tables (never synced).
  reminderState!: EntityTable<ReminderState, 'kind'>;
  schedulerState!: EntityTable<SchedulerState, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      settings: 'id, updatedAt',
      sessions: 'id, startedAt, dayKey, [dayKey+type], updatedAt',
      waterLogs: 'id, loggedAt, dayKey, updatedAt',
      reminderEvents: 'id, firedAt, dayKey, [kind+dayKey], updatedAt',
      reminderState: 'kind',
      schedulerState: 'id',
      meta: 'key',
    });
  }
}

let instance: DeskWellnessDB | null = null;

/** Lazily created singleton so tests can swap in their own instance. */
export function getDb(): DeskWellnessDB {
  if (!instance) instance = new DeskWellnessDB();
  return instance;
}

/** Test hook: replace the shared instance. */
export function setDb(db: DeskWellnessDB | null): void {
  instance = db;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for very old webviews.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const DEVICE_ID_KEY = 'deviceId';
let cachedDeviceId: string | null = null;

/** Stable per-install identifier, stamped on every write. */
export async function getDeviceId(db: DeskWellnessDB = getDb()): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const existing = await db.meta.get(DEVICE_ID_KEY);
  if (existing) {
    cachedDeviceId = existing.value;
    return existing.value;
  }
  const id = newId();
  await db.meta.put({ key: DEVICE_ID_KEY, value: id });
  cachedDeviceId = id;
  return id;
}

export function resetDeviceIdCache(): void {
  cachedDeviceId = null;
}

export type Insertable<T extends BaseEntity> = Omit<T, keyof BaseEntity> &
  Partial<Pick<BaseEntity, 'id' | 'createdAt'>>;
