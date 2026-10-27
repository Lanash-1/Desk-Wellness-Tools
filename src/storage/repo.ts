import type { Table } from 'dexie';
import type { BaseEntity } from '@/core/models';
import { getDb, getDeviceId, newId, type DeskWellnessDB, type Insertable } from './db';

/** Tables that hold syncable BaseEntity rows. */
export type SyncedTableName = 'settings' | 'sessions' | 'waterLogs' | 'reminderEvents';

/**
 * Sync-ready repository over a Dexie table.
 *
 * - put() stamps createdAt/updatedAt/deviceId.
 * - Deletes are soft: softDelete() sets deletedAt; reads filter tombstones out.
 * - changesSince()/applyRemote() exist for a future sync layer (last-writer-wins on updatedAt).
 */
export class Repo<T extends BaseEntity> {
  constructor(
    private readonly tableName: SyncedTableName,
    private readonly dbFactory: () => DeskWellnessDB = getDb,
    private readonly now: () => number = Date.now,
  ) {}

  protected get table(): Table<T, string> {
    return this.dbFactory()[this.tableName] as unknown as Table<T, string>;
  }

  async get(id: string): Promise<T | undefined> {
    const row = await this.table.get(id);
    return row && row.deletedAt == null ? row : undefined;
  }

  /** Inserts or fully replaces a row, stamping audit fields. */
  async put(data: Insertable<T>): Promise<T> {
    const now = this.now();
    const deviceId = await getDeviceId(this.dbFactory());
    const id = data.id ?? newId();
    const existing = await this.table.get(id);
    const row = {
      ...data,
      id,
      createdAt: data.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
      deviceId,
    } as T;
    await this.table.put(row);
    return row;
  }

  /** Shallow-merges a patch into an existing row. Returns undefined if missing. */
  async update(id: string, patch: Partial<Omit<T, keyof BaseEntity>>): Promise<T | undefined> {
    const existing = await this.get(id);
    if (!existing) return undefined;
    return this.put({ ...existing, ...patch } as Insertable<T>);
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.table.get(id);
    if (!existing) return;
    const now = this.now();
    const deviceId = await getDeviceId(this.dbFactory());
    await this.table.put({ ...existing, deletedAt: now, updatedAt: now, deviceId });
  }

  async listAll(): Promise<T[]> {
    return this.table.filter((r) => r.deletedAt == null).toArray();
  }

  async listByDay(dayKey: string): Promise<T[]> {
    return this.table
      .where('dayKey' as never)
      .equals(dayKey)
      .filter((r) => r.deletedAt == null)
      .toArray();
  }

  /** Rows whose `field` (an indexed epoch-ms column) falls in [fromMs, toMs). */
  async listRange(field: keyof T & string, fromMs: number, toMs: number): Promise<T[]> {
    return this.table
      .where(field as never)
      .between(fromMs, toMs, true, false)
      .filter((r) => r.deletedAt == null)
      .toArray();
  }

  /** Everything written since `updatedAt` (exclusive). Includes tombstones when asked. */
  async changesSince(updatedAt: number, includeDeleted = true): Promise<T[]> {
    const rows = await this.table
      .where('updatedAt' as never)
      .above(updatedAt)
      .toArray();
    return includeDeleted ? rows : rows.filter((r) => r.deletedAt == null);
  }

  /** Last-writer-wins merge of remote rows. */
  async applyRemote(items: T[]): Promise<void> {
    const table = this.table;
    await this.dbFactory().transaction('rw', table, async () => {
      for (const incoming of items) {
        const local = await table.get(incoming.id);
        if (!local || incoming.updatedAt > local.updatedAt) await table.put(incoming);
      }
    });
  }

  /** Hard-deletes tombstones older than `olderThanMs`. Run at startup. */
  async purgeTombstones(olderThanMs: number): Promise<number> {
    const cutoff = this.now() - olderThanMs;
    const stale = await this.table
      .filter((r) => r.deletedAt != null && r.deletedAt < cutoff)
      .primaryKeys();
    await this.table.bulkDelete(stale);
    return stale.length;
  }
}
