import { useLiveQuery } from 'dexie-react-hooks';
import type { WaterLog } from '@/core/models';
import { toDayKey } from '@/core/time/dayKey';
import { sumMl, waterForDay } from '@/storage/water';
import { useSettings } from './useSettings';
import { useTimerStore } from '@/store/timerStore';

/** Live view of today's water logs. `now` from the timer store rolls the day over at midnight. */
export function useWaterToday(): { rows: WaterLog[]; totalMl: number; dayKey: string } {
  const settings = useSettings();
  // Re-evaluate the day key once a minute, not every second.
  const minute = useTimerStore((s) => Math.floor(s.now / 60_000));
  const dayKey = toDayKey(minute * 60_000, settings?.dayStartHour ?? 0, settings?.timeZone ?? null);
  const rows = useLiveQuery(() => waterForDay(dayKey), [dayKey]) ?? [];
  return { rows, totalMl: sumMl(rows), dayKey };
}
