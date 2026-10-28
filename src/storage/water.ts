import type { WaterLog } from '@/core/models';
import { toDayKey } from '@/core/time/dayKey';
import { waterLogsRepo } from './repositories';

export interface DayKeyOptions {
  dayStartHour: number;
  timeZone: string | null;
}

export async function addWater(
  amountMl: number,
  source: WaterLog['source'],
  opts: DayKeyOptions,
  now: number = Date.now(),
): Promise<WaterLog> {
  return waterLogsRepo.put({
    loggedAt: now,
    amountMl: Math.round(amountMl),
    source,
    dayKey: toDayKey(now, opts.dayStartHour, opts.timeZone),
  });
}

export async function removeWater(id: string): Promise<void> {
  await waterLogsRepo.softDelete(id);
}

export async function waterForDay(dayKey: string): Promise<WaterLog[]> {
  const rows = await waterLogsRepo.listByDay(dayKey);
  return rows.sort((a, b) => b.loggedAt - a.loggedAt);
}

export function sumMl(rows: WaterLog[]): number {
  return rows.reduce((acc, r) => acc + r.amountMl, 0);
}
