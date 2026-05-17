//
// Copyright 2026 DXOS.org
//

// F-Today: helpers for the Node that represents a specific date.
//
// A "day-Node" is a Bramble.Node whose `supertags` array contains a
// Ref to a `Bramble.Day` instance for a given ISO `YYYY-MM-DD`.
// Per `type Day`'s uniqueness invariant, at most one such Node
// exists per (date, space). These helpers find-or-create the
// (Day, Node) pair atomically; the BramblePlugin's mount-time
// today resolver routes through `ensureDayNodeForDate(db,
// today())`. Parallel shape to `ensurePdfBrambleNode`.

import { Filter, Obj } from '@dxos/echo';

import { Bramble } from '#types';

// Return the user's local-timezone date as ISO `YYYY-MM-DD`. The
// JS Intl path avoids the off-by-one bug `Date.toISOString()` has
// in non-UTC zones (which always emits the UTC date for the
// current instant).
export const today = (now: Date = new Date()): string => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Find the FIRST `Bramble.Day` instance in `db` with the given date.
// Deterministic id tie-break (matches F-PDF-Upload's
// `findWnfsFileByCid` shape).
export const findDayInstanceForDate = (db: any, date: string): Bramble.Day | undefined => {
  if (!db || !date) {
    return undefined;
  }
  const results = (db.query(Filter.typename(Bramble.Day.typename)).runSync() ?? []) as Array<{
    object: Bramble.Day;
  }>;
  const matches = results
    .map((item) => (item as any).object ?? item)
    .filter((day: any) => day?.date === date)
    .sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
  return matches[0];
};

// Find the Bramble.Node whose `supertags` array contains a Ref to
// the given `Bramble.Day` instance. Sort-by-id tie-break extends
// F-Supertag.uniqueness to the (Day, Node) pair.
export const findNodeWrappingDay = (db: any, dayInstance: Bramble.Day): Bramble.Node | undefined => {
  if (!db || !dayInstance) {
    return undefined;
  }
  const dayId = (dayInstance as any).id;
  if (!dayId) {
    return undefined;
  }
  const results = (db.query(Filter.typename(Bramble.Node.typename)).runSync() ?? []) as Array<{
    object: Bramble.Node;
  }>;
  const matches = results
    .map((item) => (item as any).object ?? item)
    .filter((node: any) => {
      const supertags = (node?.supertags ?? []) as readonly any[];
      return supertags.some((ref) => ref?.target && (ref.target as any).id === dayId);
    })
    .sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
  return matches[0];
};

// Result of `ensureDayNodeForDate`.
export type EnsureDayNodeResult = {
  node: Bramble.Node;        // the Node wrapping the Day instance (find-or-created)
  dayInstance: Bramble.Day;  // the Day instance for the date (find-or-created)
};

// Find-or-create the (Day instance, wrapping Bramble.Node) pair for
// the given date. Idempotent — calling twice with the same date
// returns the same pair per `type Day`'s uniqueness invariant.
//
// Atomic-ish: creates the Day first, then the wrapper. A concurrent
// mount in the same tick could in principle create two; the next
// mount's normalisation sweep (parallel to F-Supertag's
// normalisation; not implemented for Day in v1) would collapse.
// In practice the today-resolver fires once per Article mount, so
// the race window is narrow.
export const ensureDayNodeForDate = (db: any, date: string): EnsureDayNodeResult | undefined => {
  if (!db || !date) {
    return undefined;
  }
  let dayInstance = findDayInstanceForDate(db, date);
  if (!dayInstance) {
    dayInstance = Obj.make(Bramble.Day, { date });
    db.add(dayInstance);
  }
  let node = findNodeWrappingDay(db, dayInstance);
  if (!node) {
    node = Bramble.makeNode({
      supertags: [db.makeRef(Obj.getDXN(dayInstance))],
    });
    db.add(node);
  }
  return { node, dayInstance };
};
