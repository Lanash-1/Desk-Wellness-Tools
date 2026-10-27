import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayKeyRange,
  dayKeyWeekday,
  isWithinRange,
  parseHHmm,
  toDayKey,
  toLocalMinutes,
  toWeekday,
} from './dayKey';

const TZ = 'America/New_York';

describe('toDayKey', () => {
  it('uses the local calendar date in the given time zone', () => {
    // 2026-03-10T03:30Z is 2026-03-09 23:30 in New York (EDT starts Mar 8).
    const ts = Date.UTC(2026, 2, 10, 3, 30);
    expect(toDayKey(ts, 0, TZ)).toBe('2026-03-09');
    expect(toDayKey(ts, 0, 'UTC')).toBe('2026-03-10');
  });

  it('shifts the day boundary by dayStartHour', () => {
    // 02:00 local on Mar 10 belongs to Mar 9 when the day starts at 04:00.
    const ts = Date.UTC(2026, 2, 10, 6, 0); // 02:00 EDT
    expect(toDayKey(ts, 0, TZ)).toBe('2026-03-10');
    expect(toDayKey(ts, 4, TZ)).toBe('2026-03-09');
    // 05:00 local is the new day.
    expect(toDayKey(Date.UTC(2026, 2, 10, 9, 0), 4, TZ)).toBe('2026-03-10');
  });

  it('is stable across a DST transition', () => {
    // US spring-forward: 2026-03-08 02:00 → 03:00 local.
    const before = Date.UTC(2026, 2, 8, 6, 59); // 01:59 EST
    const after = Date.UTC(2026, 2, 8, 7, 1); // 03:01 EDT
    expect(toDayKey(before, 0, TZ)).toBe('2026-03-08');
    expect(toDayKey(after, 0, TZ)).toBe('2026-03-08');
    // Fall back: 2026-11-01 02:00 → 01:00 local; the day stays Nov 1 either side.
    expect(toDayKey(Date.UTC(2026, 10, 1, 5, 30), 0, TZ)).toBe('2026-11-01');
    expect(toDayKey(Date.UTC(2026, 10, 1, 6, 30), 0, TZ)).toBe('2026-11-01');
  });
});

describe('toWeekday / toLocalMinutes', () => {
  it('reports the local weekday and minutes', () => {
    const ts = Date.UTC(2026, 9, 27, 14, 5); // Tue 10:05 EDT
    expect(toWeekday(ts, 0, TZ)).toBe(2);
    expect(toLocalMinutes(ts, TZ)).toBe(10 * 60 + 5);
  });
});

describe('isWithinRange', () => {
  it('handles plain ranges', () => {
    expect(isWithinRange(parseHHmm('09:00'), '09:00', '18:00')).toBe(true);
    expect(isWithinRange(parseHHmm('18:00'), '09:00', '18:00')).toBe(false);
    expect(isWithinRange(parseHHmm('08:59'), '09:00', '18:00')).toBe(false);
  });

  it('handles ranges that cross midnight', () => {
    expect(isWithinRange(parseHHmm('23:30'), '22:00', '06:00')).toBe(true);
    expect(isWithinRange(parseHHmm('03:00'), '22:00', '06:00')).toBe(true);
    expect(isWithinRange(parseHHmm('12:00'), '22:00', '06:00')).toBe(false);
  });

  it('treats an empty range as never matching', () => {
    expect(isWithinRange(600, '10:00', '10:00')).toBe(false);
  });
});

describe('dayKey arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('computes weekdays and ranges', () => {
    expect(dayKeyWeekday('2026-10-27')).toBe(2); // Tuesday
    expect(dayKeyRange('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });
});
