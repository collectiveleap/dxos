//
// Copyright 2026 DXOS.org
//

import { type Obj } from '@dxos/echo';

import { type Capture } from '../types';

export interface Cluster {
  readonly referent: Obj.Unknown | undefined;
  readonly captures: readonly Capture.Capture[];
  readonly latestFlaggedAt: string;
}

/** The maximum (most recent) ISO timestamp in `times`, or '' when empty. */
export const latestFlaggedAt = (times: readonly string[]): string =>
  times.reduce((max, value) => (value > max ? value : max), '');

/** Orders items by `latestFlaggedAt`, most recent first. Stable, non-mutating. */
export const orderClusters = <T extends { latestFlaggedAt: string }>(clusters: readonly T[]): T[] =>
  [...clusters].sort((a, b) =>
    a.latestFlaggedAt < b.latestFlaggedAt ? 1 : a.latestFlaggedAt > b.latestFlaggedAt ? -1 : 0,
  );

/**
 * Groups captures under the `referent` they are about, ordering clusters most-recently-flagged first
 * and captures within a cluster `flaggedAt`-descending. Captures whose `referent` ref is unset or
 * unresolved fall into a single uncategorized cluster (`referent: undefined`).
 */
export const clusterByReferent = (captures: readonly Capture.Capture[]): Cluster[] => {
  const byReferent = new Map<string, { referent: Obj.Unknown | undefined; captures: Capture.Capture[] }>();
  for (const capture of captures) {
    const referent = capture.referent?.target ?? undefined;
    const key = referent?.id ?? '';
    const entry = byReferent.get(key) ?? { referent, captures: [] };
    entry.captures.push(capture);
    byReferent.set(key, entry);
  }
  const clusters = [...byReferent.values()].map(({ referent, captures: cs }) => ({
    referent,
    captures: [...cs].sort((a, b) => (a.flaggedAt < b.flaggedAt ? 1 : a.flaggedAt > b.flaggedAt ? -1 : 0)),
    latestFlaggedAt: latestFlaggedAt(cs.map((c) => c.flaggedAt)),
  }));
  return orderClusters(clusters);
};
