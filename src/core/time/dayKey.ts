/**
 * Day-key helpers. A dayKey is 'YYYY-MM-DD' in the given (or device) time zone,
 * shifted by `dayStartHour` so that, e.g., 01:30 still belongs to "yesterday" when the
 * user's day starts at 04:00.
 */

const HOUR_MS = 60 * 60 * 1000;

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  weekday: number; // 0 = Sunday … 6 = Saturday
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? '__device__';
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
    formatterCache.set(key, fmt);
  }
  return fmt;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function localParts(ts: number, timeZone?: string | null): LocalParts {
  const parts = getFormatter(timeZone ?? undefined).formatToParts(new Date(ts));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: WEEKDAYS.indexOf(get('weekday')),
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Returns the dayKey for a timestamp. `dayStartHour` shifts the boundary: with
 * dayStartHour = 4, anything before 04:00 local counts as the previous day.
 */
export function toDayKey(ts: number, dayStartHour = 0, timeZone?: string | null): string {
  const shifted = ts - dayStartHour * HOUR_MS;
  const p = localParts(shifted, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Weekday (0-6) of the dayKey a timestamp belongs to. */
export function toWeekday(ts: number, dayStartHour = 0, timeZone?: string | null): number {
  return localParts(ts - dayStartHour * HOUR_MS, timeZone).weekday;
}

/** Local 'HH:mm' minutes-since-midnight for a timestamp. */
export function toLocalMinutes(ts: number, timeZone?: string | null): number {
  const p = localParts(ts, timeZone);
  return p.hour * 60 + p.minute;
}

/** Parses 'HH:mm' into minutes since midnight. */
export function parseHHmm(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Whether local time `minutes` falls inside [start, end). Handles ranges that cross
 * midnight (e.g. 22:00 → 06:00).
 */
export function isWithinRange(minutes: number, startHHmm: string, endHHmm: string): boolean {
  const start = parseHHmm(startHHmm);
  const end = parseHHmm(endHHmm);
  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

/** Adds `days` calendar days to a dayKey (pure string arithmetic, timezone-free). */
export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Weekday (0-6) of a dayKey, independent of time zone. */
export function dayKeyWeekday(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Returns dayKeys for the inclusive range [from, to]. */
export function dayKeyRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
