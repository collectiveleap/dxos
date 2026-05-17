//
// Copyright 2026 DXOS.org
//

// F-One-Graph: per-space singleton helper for `Bramble.Graph`.
//
// Mirrors the existing per-space singleton pattern used for the
// Schema Node, Library Node, tag-Nodes, and option-Nodes
// (`findOrCreate*Block + acquireLock`). Find-or-create semantics
// — the BramblePlugin's create-menu callback routes through here
// so re-invoking the menu item when a Bramble already exists is
// a no-op (returns the existing instance) per
// F-One-Graph.create-action-is-idempotent.

import { Filter } from '@dxos/echo';

import { Bramble } from '#types';

// Find the singleton `Bramble.Graph` in the space, if any. Returns
// the FIRST match deterministically (lowest id wins) so concurrent
// reads converge.
export const findBrambleGraph = (db: any): Bramble.Graph | undefined => {
  if (!db) {
    return undefined;
  }
  const results = (db.query(Filter.typename(Bramble.Graph.typename)).runSync() ?? []) as Array<{
    object: Bramble.Graph;
  }>;
  const matches = results
    .map((item) => (item as any).object ?? item)
    .sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
  return matches[0];
};

// Find or create the per-space `Bramble.Graph`. Idempotent — calling
// twice with the same db returns the same instance. Per F-One-Graph,
// at most one Bramble.Graph exists per space; this is the only write
// path that creates one.
export const findOrCreateBrambleGraph = (db: any, name?: string): Bramble.Graph => {
  const existing = findBrambleGraph(db);
  if (existing) {
    return existing;
  }
  const graph = Bramble.makeGraph({ name });
  db.add(graph);
  return graph;
};

// True when the space already contains a Bramble.Graph. Cheap O(n)
// over Bramble.Graph instances (expected n ≤ 1 post-F-One-Graph; n can
// be greater in pre-singleton test spaces).
export const hasBrambleGraph = (db: any): boolean => {
  return findBrambleGraph(db) !== undefined;
};
