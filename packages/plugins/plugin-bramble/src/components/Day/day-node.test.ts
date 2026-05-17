//
// Copyright 2026 DXOS.org
//

// F-Today: unit coverage of the pure date helper. The db-touching
// helpers (`findDayInstanceForDate`, `findNodeWrappingDay`,
// `ensureDayNodeForDate`) are exercised end-to-end via the
// `T-Today-*` smoke entries in PLUGIN.mdl — they need a live ECHO
// client to exercise queries and writes.

import { describe, test } from 'vitest';

import { today } from './day-node';

describe('today', () => {
  test('returns ISO YYYY-MM-DD shape', ({ expect }) => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('uses local timezone, not UTC (avoids `toISOString` off-by-one)', ({ expect }) => {
    // 2026-03-15 at 23:30 LOCAL time. The local date is 2026-03-15
    // regardless of what UTC says (in a positive-UTC-offset zone
    // it might be 2026-03-16 already in UTC). Our `today()` must
    // return the LOCAL date.
    const localLateEvening = new Date(2026, 2, 15, 23, 30, 0);
    expect(today(localLateEvening)).toBe('2026-03-15');
  });

  test('zero-pads single-digit months and days', ({ expect }) => {
    expect(today(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
    expect(today(new Date(2026, 8, 9, 12, 0, 0))).toBe('2026-09-09');
  });

  test('handles year boundary correctly', ({ expect }) => {
    expect(today(new Date(2026, 11, 31, 12, 0, 0))).toBe('2026-12-31');
    expect(today(new Date(2027, 0, 1, 12, 0, 0))).toBe('2027-01-01');
  });
});
